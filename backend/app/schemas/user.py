from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "email": "user@baidu.com",
                    "password": "securepassword",
                    "display_name": "John Doe",
                }
            ]
        }
    }


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "email": "user@baidu.com",
                    "password": "securepassword",
                }
            ]
        }
    }


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    is_admin: bool
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
