# Copyright (C) 2025 Xiaomi Corporation
# This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.

"""
MIoT Kit setup.
"""
from setuptools import setup, find_packages
import toml

data = toml.load("pyproject.toml")
version: str = data.get("project", {}).get("version")
if not version:
    raise ValueError("Version not found in pyproject.toml")

setup(
    name="miot_kit",
    version=version,
    description="MIoT Kit",
    author="MIoT Development Team",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "miot_kit": ["libs/**/*.*", "specs/*", "i18n/**/*.*", "configs/*"]
    },
    python_requires=">=3.10",
    install_requires=[
        "aiocache>=0.12",
        "aiofiles>=24.1",
        "asyncio>=4.0.0",
        "aiohttp>=3.12.14",
        "psutil>=7.0.0",
        "pydantic>=2.4.0",
        "fastmcp>=2.11,<3",
        "zeroconf>=0.147",
        "av>=15.0",
        "pillow>=10.3.0",
        "toml>=0.10.2",
    ],
)
