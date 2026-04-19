import math
from collections import defaultdict, deque

from app.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    NodeCostResult,
)


def calculate_pipeline_cost(req: CalculateRequest) -> CalculateResponse:
    """
    Core calculation engine for pipeline cost estimation.

    Algorithm:
    1. Convert global input to target QPS
    2. Build graph from edges
    3. Topological sort (Kahn's algorithm)
    4. Forward-propagate QPS through the DAG
    5. Calculate instances and costs per node
    6. Aggregate totals
    """

    # ------------------------------------------------------------------ #
    # Step 1 -- Convert target input to QPS
    # ------------------------------------------------------------------ #
    global_input = req.global_input
    if global_input.input_type == "qps":
        target_qps = global_input.value
    else:  # concurrency
        avg_rt_sec = global_input.avg_response_time_ms / 1000.0
        if avg_rt_sec <= 0:
            raise ValueError("avg_response_time_ms must be > 0 for concurrency mode")
        target_qps = global_input.value / avg_rt_sec

    if target_qps <= 0:
        raise ValueError("Computed target QPS must be > 0")

    # ------------------------------------------------------------------ #
    # Step 2 -- Build node lookup and adjacency structures
    # ------------------------------------------------------------------ #
    node_map: dict[str, dict] = {}
    for node in req.nodes:
        if node.node_id in node_map:
            raise ValueError(f"Duplicate node_id: {node.node_id}")
        node_map[node.node_id] = {
            "config": node,
            "allocated_qps": 0.0,
        }

    # Validate edges reference existing nodes
    for edge in req.edges:
        if edge.source not in node_map:
            raise ValueError(f"Edge source '{edge.source}' does not match any node")
        if edge.target not in node_map:
            raise ValueError(f"Edge target '{edge.target}' does not match any node")

    # adjacency: source -> list of (target, split_ratio)
    adjacency: dict[str, list[tuple[str, float]]] = defaultdict(list)
    in_degree: dict[str, int] = {nid: 0 for nid in node_map}

    for edge in req.edges:
        adjacency[edge.source].append((edge.target, edge.split_ratio))
        in_degree[edge.target] += 1

    # ------------------------------------------------------------------ #
    # Step 3 -- Identify source nodes & topological sort (Kahn's)
    # ------------------------------------------------------------------ #
    source_nodes = [nid for nid, deg in in_degree.items() if deg == 0]

    if not source_nodes and len(node_map) > 0:
        raise ValueError("No source nodes found (all nodes have incoming edges — possible cycle)")

    queue: deque[str] = deque(source_nodes)
    topo_order: list[str] = []

    while queue:
        nid = queue.popleft()
        topo_order.append(nid)
        for target, _ in adjacency.get(nid, []):
            in_degree[target] -= 1
            if in_degree[target] == 0:
                queue.append(target)

    if len(topo_order) != len(node_map):
        raise ValueError("Cycle detected in pipeline graph")

    # ------------------------------------------------------------------ #
    # Step 4 -- Forward propagate QPS
    # ------------------------------------------------------------------ #
    # Source nodes get target_qps
    for nid in source_nodes:
        node_map[nid]["allocated_qps"] = target_qps

    for nid in topo_order:
        node_qps = node_map[nid]["allocated_qps"]
        outgoing = adjacency.get(nid, [])
        if not outgoing:
            continue

        # Normalize split_ratios among outgoing edges from this node
        total_ratio = sum(ratio for _, ratio in outgoing)
        if total_ratio <= 0:
            raise ValueError(
                f"Node '{nid}' has outgoing edges with total split_ratio <= 0"
            )

        for target, ratio in outgoing:
            normalized_ratio = ratio / total_ratio
            node_map[target]["allocated_qps"] += node_qps * normalized_ratio

    # ------------------------------------------------------------------ #
    # Step 5 -- Calculate instances and costs
    # ------------------------------------------------------------------ #
    node_results: list[NodeCostResult] = []

    for nid in topo_order:
        entry = node_map[nid]
        cfg = entry["config"]
        node_qps = entry["allocated_qps"]

        if cfg.qps_per_instance <= 0:
            raise ValueError(
                f"Node '{nid}' has qps_per_instance <= 0"
            )

        raw_instances = math.ceil(node_qps / cfg.qps_per_instance)
        # Ensure at least 1 instance if QPS > 0
        if raw_instances < 1 and node_qps > 0:
            raw_instances = 1

        ha_instances: int | None = None
        if req.ha_enabled:
            if req.ha_mode == "2_gpu":
                ha_instances = max(raw_instances, 2)
            elif req.ha_mode == "2_machine":
                gpus = cfg.gpus_per_machine if cfg.gpus_per_machine > 0 else 1
                ha_instances = max(raw_instances, 2 * gpus)
            else:
                ha_instances = max(raw_instances, 2)

        final_instances = ha_instances if req.ha_enabled else raw_instances

        # Cost calculation
        if cfg.cost_type == "per_gpu":
            node_cost = final_instances * cfg.cost_per_unit
        elif cfg.cost_type == "per_machine":
            gpus = cfg.gpus_per_machine if cfg.gpus_per_machine > 0 else 1
            machines = math.ceil(final_instances / gpus)
            node_cost = machines * cfg.cost_per_unit
        else:
            raise ValueError(f"Unknown cost_type '{cfg.cost_type}' for node '{nid}'")

        node_results.append(
            NodeCostResult(
                node_id=nid,
                module_name=cfg.module_name,
                allocated_qps=round(node_qps, 4),
                raw_instances=raw_instances,
                ha_instances=ha_instances,
                final_instances=final_instances,
                node_cost=round(node_cost, 4),
                resource_spec_name=cfg.resource_spec_name,
            )
        )

    # ------------------------------------------------------------------ #
    # Step 6 -- Aggregate totals
    # ------------------------------------------------------------------ #
    total_gpu_cost = sum(nr.node_cost for nr in node_results)
    e2e_total_cost = total_gpu_cost * req.e2e_coefficient
    unit_cost = e2e_total_cost / target_qps if target_qps > 0 else 0.0

    if global_input.input_type == "qps":
        unit_label = "\u5143/QPS"
    else:
        unit_label = "\u5143/\u5e76\u53d1"

    return CalculateResponse(
        nodes=node_results,
        total_gpu_cost=round(total_gpu_cost, 4),
        e2e_coefficient=req.e2e_coefficient,
        e2e_total_cost=round(e2e_total_cost, 4),
        unit_cost=round(unit_cost, 4),
        unit_label=unit_label,
        target_qps=round(target_qps, 4),
    )
