"""
Comprehensive unit tests for the pipeline cost calculation engine.

Tests cover:
1. Basic single-node calculation
2. Linear pipeline (A -> B -> C)
3. Branching (split) pipeline
4. Merge pipeline (multiple inputs to one node)
5. Branch-then-merge (diamond shape)
6. QPS mode vs Concurrency mode
7. E2E coefficient application
8. HA mode: 2_gpu
9. HA mode: 2_machine
10. Multi-GPU per instance (gpus_per_instance)
11. Edge cases: cycle detection, duplicate nodes, invalid edges
12. Split ratio normalization
"""

import math
import pytest

from app.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    EdgeConfig,
    GlobalInput,
    NodeConfig,
)
from app.services.calculation import calculate_pipeline_cost


# ---------------------------------------------------------------------------
# Helper to build a request quickly
# ---------------------------------------------------------------------------


def make_node(
    node_id: str,
    module_name: str = "模块",
    qps_per_instance: float = 50.0,
    cost_per_unit: float = 25.0,
    gpus_per_instance: int = 1,
    gpus_per_machine: int = 1,
    avg_response_time_ms: float = 100.0,
    resource_spec_name: str = "",
) -> NodeConfig:
    return NodeConfig(
        node_id=node_id,
        module_name=module_name,
        qps_per_instance=qps_per_instance,
        cost_per_unit=cost_per_unit,
        gpus_per_instance=gpus_per_instance,
        gpus_per_machine=gpus_per_machine,
        avg_response_time_ms=avg_response_time_ms,
        resource_spec_name=resource_spec_name,
    )


def make_edge(source: str, target: str, split_ratio: float = 1.0) -> EdgeConfig:
    return EdgeConfig(source=source, target=target, split_ratio=split_ratio)


def make_request(
    nodes: list[NodeConfig],
    edges: list[EdgeConfig],
    value: float = 100.0,
    input_type: str = "qps",
    avg_response_time_ms: float = 100.0,
    e2e_coefficient: float = 1.0,
    ha_enabled: bool = False,
    ha_mode: str = "2_gpu",
) -> CalculateRequest:
    return CalculateRequest(
        nodes=nodes,
        edges=edges,
        global_input=GlobalInput(
            input_type=input_type,
            value=value,
            avg_response_time_ms=avg_response_time_ms,
        ),
        e2e_coefficient=e2e_coefficient,
        ha_enabled=ha_enabled,
        ha_mode=ha_mode,
    )


# ===========================================================================
# Test 1: Single node, QPS mode
# ===========================================================================


class TestSingleNode:
    def test_basic(self):
        """Single node, 100 QPS target, 50 QPS/instance → 2 instances × 25 = 50"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=50, cost_per_unit=25)],
            edges=[],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.target_qps == 100.0
        assert len(resp.nodes) == 1
        node_a = resp.nodes[0]
        assert node_a.node_id == "A"
        assert node_a.allocated_qps == 100.0
        assert node_a.raw_instances == 2  # ceil(100/50)
        assert node_a.final_instances == 2
        assert node_a.node_cost == 50.0  # 2 × 25
        assert node_a.total_gpus == 2  # 2 × 1 (default gpus_per_instance)
        assert resp.total_gpu_cost == 50.0
        assert resp.e2e_total_cost == 50.0
        assert resp.unit_cost == 0.5  # 50/100

    def test_fractional_instances(self):
        """75 QPS / 50 per instance → ceil = 2 instances"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=50, cost_per_unit=10)],
            edges=[],
            value=75,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.nodes[0].raw_instances == 2  # ceil(75/50) = 2
        assert resp.nodes[0].node_cost == 20.0

    def test_exact_division(self):
        """100 QPS / 50 per instance → exactly 2"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=50)],
            edges=[],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.nodes[0].raw_instances == 2


# ===========================================================================
# Test 2: Linear pipeline A → B → C
# ===========================================================================


class TestLinearPipeline:
    def test_qps_propagation(self):
        """All nodes get the same QPS in a linear chain"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100, cost_per_unit=10),
                make_node("B", qps_per_instance=50, cost_per_unit=20),
                make_node("C", qps_per_instance=25, cost_per_unit=30),
            ],
            edges=[make_edge("A", "B"), make_edge("B", "C")],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        a = next(n for n in resp.nodes if n.node_id == "A")
        b = next(n for n in resp.nodes if n.node_id == "B")
        c = next(n for n in resp.nodes if n.node_id == "C")

        assert a.allocated_qps == 100.0
        assert b.allocated_qps == 100.0
        assert c.allocated_qps == 100.0

        assert a.raw_instances == 1  # ceil(100/100)
        assert b.raw_instances == 2  # ceil(100/50)
        assert c.raw_instances == 4  # ceil(100/25)

        assert a.node_cost == 10.0
        assert b.node_cost == 40.0
        assert c.node_cost == 120.0

        assert resp.total_gpu_cost == 170.0


# ===========================================================================
# Test 3: Branching pipeline A → B, A → C (split)
# ===========================================================================


class TestBranchingPipeline:
    def test_equal_split(self):
        """A splits 50/50 to B and C"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100, cost_per_unit=10),
                make_node("B", qps_per_instance=50, cost_per_unit=20),
                make_node("C", qps_per_instance=50, cost_per_unit=20),
            ],
            edges=[
                make_edge("A", "B", split_ratio=1.0),
                make_edge("A", "C", split_ratio=1.0),
            ],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        b = next(n for n in resp.nodes if n.node_id == "B")
        c = next(n for n in resp.nodes if n.node_id == "C")

        assert b.allocated_qps == 50.0
        assert c.allocated_qps == 50.0
        assert b.raw_instances == 1
        assert c.raw_instances == 1

    def test_unequal_split(self):
        """A splits 70/30 to B and C"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100, cost_per_unit=10),
                make_node("B", qps_per_instance=50, cost_per_unit=20),
                make_node("C", qps_per_instance=50, cost_per_unit=20),
            ],
            edges=[
                make_edge("A", "B", split_ratio=7.0),
                make_edge("A", "C", split_ratio=3.0),
            ],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        b = next(n for n in resp.nodes if n.node_id == "B")
        c = next(n for n in resp.nodes if n.node_id == "C")

        assert b.allocated_qps == 70.0
        assert c.allocated_qps == 30.0
        assert b.raw_instances == 2  # ceil(70/50)
        assert c.raw_instances == 1  # ceil(30/50)


# ===========================================================================
# Test 4: Merge pipeline: B → D, C → D
# ===========================================================================


class TestMergePipeline:
    def test_merge_sums_qps(self):
        """Two sources B(60 QPS) and C(40 QPS) merge into D → D gets 100 QPS"""
        req = make_request(
            nodes=[
                make_node("B", qps_per_instance=100, cost_per_unit=10),
                make_node("C", qps_per_instance=100, cost_per_unit=10),
                make_node("D", qps_per_instance=50, cost_per_unit=20),
            ],
            edges=[make_edge("B", "D"), make_edge("C", "D")],
            value=100,
        )
        # B and C are both source nodes → both get target_qps=100
        resp = calculate_pipeline_cost(req)
        d = next(n for n in resp.nodes if n.node_id == "D")
        # D receives 100 from B + 100 from C = 200
        assert d.allocated_qps == 200.0
        assert d.raw_instances == 4  # ceil(200/50)


# ===========================================================================
# Test 5: Diamond shape: A → B, A → C, B → D, C → D
# ===========================================================================


class TestDiamondPipeline:
    def test_diamond(self):
        """A splits to B and C, both merge into D"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100, cost_per_unit=10),
                make_node("B", qps_per_instance=50, cost_per_unit=20),
                make_node("C", qps_per_instance=50, cost_per_unit=20),
                make_node("D", qps_per_instance=25, cost_per_unit=30),
            ],
            edges=[
                make_edge("A", "B", split_ratio=1.0),
                make_edge("A", "C", split_ratio=1.0),
                make_edge("B", "D"),
                make_edge("C", "D"),
            ],
            value=100,
        )
        resp = calculate_pipeline_cost(req)

        a = next(n for n in resp.nodes if n.node_id == "A")
        b = next(n for n in resp.nodes if n.node_id == "B")
        c = next(n for n in resp.nodes if n.node_id == "C")
        d = next(n for n in resp.nodes if n.node_id == "D")

        assert a.allocated_qps == 100.0
        assert b.allocated_qps == 50.0
        assert c.allocated_qps == 50.0
        assert d.allocated_qps == 100.0  # 50 + 50 merge

        assert d.raw_instances == 4  # ceil(100/25)
        assert d.node_cost == 120.0  # 4 × 30


# ===========================================================================
# Test 6: Concurrency mode
# ===========================================================================


class TestConcurrencyMode:
    def test_conversion(self):
        """Concurrency=100, avg_rt=200ms → QPS = 100 / 0.2 = 500"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=100, cost_per_unit=10)],
            edges=[],
            value=100,
            input_type="concurrency",
            avg_response_time_ms=200,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.target_qps == 500.0
        assert resp.nodes[0].allocated_qps == 500.0
        assert resp.nodes[0].raw_instances == 5  # ceil(500/100)
        assert resp.unit_label == "元/并发"

    def test_qps_mode_label(self):
        req = make_request(
            nodes=[make_node("A")],
            edges=[],
            value=100,
            input_type="qps",
        )
        resp = calculate_pipeline_cost(req)
        assert resp.unit_label == "元/QPS"


# ===========================================================================
# Test 7: E2E coefficient
# ===========================================================================


class TestE2ECoefficient:
    def test_coefficient_applied(self):
        """GPU cost = 50, coefficient = 1.3 → E2E cost = 65"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=50, cost_per_unit=25)],
            edges=[],
            value=100,
            e2e_coefficient=1.3,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.total_gpu_cost == 50.0
        assert resp.e2e_total_cost == 65.0
        assert resp.e2e_coefficient == 1.3
        # unit_cost = 65 / 100 = 0.65
        assert resp.unit_cost == 0.65

    def test_coefficient_one(self):
        """Default coefficient 1.0 → E2E = GPU"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=50, cost_per_unit=25)],
            edges=[],
            value=100,
            e2e_coefficient=1.0,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.total_gpu_cost == resp.e2e_total_cost


# ===========================================================================
# Test 8: HA mode — 2_gpu
# ===========================================================================


class TestHA2GPU:
    def test_ha_pads_to_minimum_2(self):
        """1 instance needed, HA 2_gpu → min 2 instances"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=200, cost_per_unit=25)],
            edges=[],
            value=100,
            ha_enabled=True,
            ha_mode="2_gpu",
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 1  # ceil(100/200) = 1
        assert a.ha_instances == 2  # max(1, 2) = 2
        assert a.final_instances == 2
        assert a.node_cost == 50.0  # 2 × 25

    def test_ha_no_pad_when_already_enough(self):
        """5 instances needed, HA 2_gpu → stays at 5"""
        req = make_request(
            nodes=[make_node("A", qps_per_instance=20, cost_per_unit=10)],
            edges=[],
            value=100,
            ha_enabled=True,
            ha_mode="2_gpu",
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 5
        assert a.ha_instances == 5  # max(5, 2) = 5
        assert a.final_instances == 5


# ===========================================================================
# Test 9: HA mode — 2_machine
# ===========================================================================


class TestHA2Machine:
    def test_ha_2_machine_with_8_gpus(self):
        """1 instance needed, HA 2_machine with 8 GPUs/machine → min 2×8=16"""
        req = make_request(
            nodes=[
                make_node(
                    "A",
                    qps_per_instance=200,
                    cost_per_unit=25,
                    gpus_per_instance=1,
                    gpus_per_machine=8,
                )
            ],
            edges=[],
            value=100,
            ha_enabled=True,
            ha_mode="2_machine",
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 1
        assert a.ha_instances == 16  # max(1, 2×8)
        assert a.final_instances == 16
        assert a.total_gpus == 16  # 16 × 1
        assert a.node_cost == 400.0  # 16 × 25

    def test_ha_2_machine_already_exceeds(self):
        """20 instances, 4 GPUs/machine → min 2×4=8, stays at 20"""
        req = make_request(
            nodes=[
                make_node(
                    "A",
                    qps_per_instance=5,
                    cost_per_unit=10,
                    gpus_per_instance=1,
                    gpus_per_machine=4,
                )
            ],
            edges=[],
            value=100,
            ha_enabled=True,
            ha_mode="2_machine",
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 20
        assert a.ha_instances == 20  # max(20, 8) = 20
        assert a.total_gpus == 20  # 20 × 1
        assert a.node_cost == 200.0  # 20 × 10


# ===========================================================================
# Test 10: Multi-GPU per instance (gpus_per_instance)
# ===========================================================================


class TestMultiGpuPerInstance:
    def test_single_gpu_per_instance(self):
        """Default: 1 GPU/instance, 3 instances → 3 GPUs, cost = 3 × 25"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=40, cost_per_unit=25, gpus_per_instance=1)
            ],
            edges=[],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 3  # ceil(100/40)
        assert a.total_gpus == 3  # 3 × 1
        assert a.node_cost == 75.0  # 3 × 25

    def test_multi_gpu_per_instance(self):
        """8 GPUs/instance, 3 instances → 24 GPUs, cost = 24 × 25"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=40, cost_per_unit=25, gpus_per_instance=8)
            ],
            edges=[],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 3  # ceil(100/40)
        assert a.total_gpus == 24  # 3 × 8
        assert a.node_cost == 600.0  # 24 × 25

    def test_multi_gpu_with_ha(self):
        """1 instance × 4 GPUs, HA 2_gpu → 2 instances × 4 = 8 GPUs"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=200, cost_per_unit=50, gpus_per_instance=4)
            ],
            edges=[],
            value=100,
            ha_enabled=True,
            ha_mode="2_gpu",
        )
        resp = calculate_pipeline_cost(req)
        a = resp.nodes[0]
        assert a.raw_instances == 1
        assert a.ha_instances == 2
        assert a.final_instances == 2
        assert a.total_gpus == 8  # 2 × 4
        assert a.node_cost == 400.0  # 8 × 50


# ===========================================================================
# Test 11: Error cases
# ===========================================================================


class TestErrorCases:
    def test_cycle_detection(self):
        """A → B → A should raise ValueError"""
        req = make_request(
            nodes=[make_node("A"), make_node("B")],
            edges=[make_edge("A", "B"), make_edge("B", "A")],
            value=100,
        )
        with pytest.raises(ValueError, match="[Cc]ycle"):
            calculate_pipeline_cost(req)

    def test_duplicate_node_id(self):
        req = make_request(
            nodes=[make_node("A"), make_node("A")],
            edges=[],
            value=100,
        )
        with pytest.raises(ValueError, match="Duplicate"):
            calculate_pipeline_cost(req)

    def test_invalid_edge_source(self):
        req = make_request(
            nodes=[make_node("A")],
            edges=[make_edge("X", "A")],
            value=100,
        )
        with pytest.raises(ValueError, match="source"):
            calculate_pipeline_cost(req)

    def test_invalid_edge_target(self):
        req = make_request(
            nodes=[make_node("A")],
            edges=[make_edge("A", "X")],
            value=100,
        )
        with pytest.raises(ValueError, match="target"):
            calculate_pipeline_cost(req)

    def test_zero_qps_per_instance(self):
        req = make_request(
            nodes=[make_node("A", qps_per_instance=0)],
            edges=[],
            value=100,
        )
        with pytest.raises(ValueError, match="qps_per_instance"):
            calculate_pipeline_cost(req)

    def test_zero_target_qps(self):
        req = make_request(
            nodes=[make_node("A")],
            edges=[],
            value=0,
            input_type="qps",
        )
        with pytest.raises(ValueError, match="target QPS"):
            calculate_pipeline_cost(req)

    def test_zero_avg_rt_concurrency(self):
        req = make_request(
            nodes=[make_node("A")],
            edges=[],
            value=100,
            input_type="concurrency",
            avg_response_time_ms=0,
        )
        with pytest.raises(ValueError, match="avg_response_time_ms"):
            calculate_pipeline_cost(req)


# ===========================================================================
# Test 12: Split ratio normalization
# ===========================================================================


class TestSplitRatioNormalization:
    def test_ratios_normalized(self):
        """Ratios 3:7 should normalize to 30%/70%"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100, cost_per_unit=10),
                make_node("B", qps_per_instance=50, cost_per_unit=20),
                make_node("C", qps_per_instance=50, cost_per_unit=20),
            ],
            edges=[
                make_edge("A", "B", split_ratio=3.0),
                make_edge("A", "C", split_ratio=7.0),
            ],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        b = next(n for n in resp.nodes if n.node_id == "B")
        c = next(n for n in resp.nodes if n.node_id == "C")
        assert b.allocated_qps == 30.0
        assert c.allocated_qps == 70.0

    def test_single_outgoing_edge(self):
        """Single edge with ratio 0.5 should still pass 100% of QPS"""
        req = make_request(
            nodes=[
                make_node("A", qps_per_instance=100),
                make_node("B", qps_per_instance=50),
            ],
            edges=[make_edge("A", "B", split_ratio=0.5)],
            value=100,
        )
        resp = calculate_pipeline_cost(req)
        b = next(n for n in resp.nodes if n.node_id == "B")
        # Single outgoing edge: 0.5/0.5 = 1.0 → B gets full 100 QPS
        assert b.allocated_qps == 100.0


# ===========================================================================
# Test 13: Complex realistic pipeline
# ===========================================================================


class TestRealisticPipeline:
    def test_full_pipeline(self):
        """
        网关 → LLM推理 (60%)
        网关 → 向量检索 (40%)
        LLM推理 → 后处理
        向量检索 → 后处理

        Target: 1000 QPS, E2E coefficient: 1.2, HA 2_gpu
        """
        req = make_request(
            nodes=[
                make_node("gateway", module_name="网关", qps_per_instance=500, cost_per_unit=5),
                make_node("llm", module_name="LLM推理", qps_per_instance=10, cost_per_unit=50),
                make_node("vector", module_name="向量检索", qps_per_instance=200, cost_per_unit=15),
                make_node("postproc", module_name="后处理", qps_per_instance=100, cost_per_unit=10),
            ],
            edges=[
                make_edge("gateway", "llm", split_ratio=6),
                make_edge("gateway", "vector", split_ratio=4),
                make_edge("llm", "postproc"),
                make_edge("vector", "postproc"),
            ],
            value=1000,
            e2e_coefficient=1.2,
            ha_enabled=True,
            ha_mode="2_gpu",
        )
        resp = calculate_pipeline_cost(req)

        gw = next(n for n in resp.nodes if n.node_id == "gateway")
        llm = next(n for n in resp.nodes if n.node_id == "llm")
        vec = next(n for n in resp.nodes if n.node_id == "vector")
        pp = next(n for n in resp.nodes if n.node_id == "postproc")

        # QPS allocation
        assert gw.allocated_qps == 1000.0
        assert llm.allocated_qps == 600.0  # 60% of 1000
        assert vec.allocated_qps == 400.0  # 40% of 1000
        assert pp.allocated_qps == 1000.0  # 600 + 400 merge

        # Instance counts (raw)
        assert gw.raw_instances == 2  # ceil(1000/500)
        assert llm.raw_instances == 60  # ceil(600/10)
        assert vec.raw_instances == 2  # ceil(400/200)
        assert pp.raw_instances == 10  # ceil(1000/100)

        # HA 2_gpu: all already >= 2, so no padding needed
        assert gw.ha_instances == 2
        assert llm.ha_instances == 60
        assert vec.ha_instances == 2
        assert pp.ha_instances == 10

        # Costs
        assert gw.node_cost == 10.0  # 2 × 5
        assert llm.node_cost == 3000.0  # 60 × 50
        assert vec.node_cost == 30.0  # 2 × 15
        assert pp.node_cost == 100.0  # 10 × 10

        total_gpu = 10 + 3000 + 30 + 100
        assert resp.total_gpu_cost == total_gpu
        assert resp.e2e_total_cost == total_gpu * 1.2
        assert resp.unit_cost == pytest.approx(total_gpu * 1.2 / 1000, abs=0.01)


# ===========================================================================
# Test 14: Empty pipeline (no nodes)
# ===========================================================================


class TestEmptyPipeline:
    def test_no_nodes(self):
        """Empty pipeline should return zeros"""
        req = make_request(nodes=[], edges=[], value=100)
        resp = calculate_pipeline_cost(req)
        assert len(resp.nodes) == 0
        assert resp.total_gpu_cost == 0.0
        assert resp.e2e_total_cost == 0.0


# ===========================================================================
# Test 15: HA disabled — ha_instances should be None
# ===========================================================================


class TestHADisabled:
    def test_no_ha(self):
        req = make_request(
            nodes=[make_node("A", qps_per_instance=200, cost_per_unit=25)],
            edges=[],
            value=100,
            ha_enabled=False,
        )
        resp = calculate_pipeline_cost(req)
        assert resp.nodes[0].ha_instances is None
        assert resp.nodes[0].final_instances == 1
