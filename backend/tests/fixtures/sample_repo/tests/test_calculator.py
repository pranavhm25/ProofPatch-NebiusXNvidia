import sys
from pathlib import Path

# Add project root to path for testing
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.calculator import absolute_value


def test_positive():
    assert absolute_value(10) == 10


def test_zero():
    assert absolute_value(0) == 0


def test_negative():
    assert absolute_value(-15) == 15
