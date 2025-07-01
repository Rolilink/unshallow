"""Legacy module that needs to be removed."""

import sys
import os

OLD_CONSTANT = "This is outdated"
LEGACY_VERSION = "0.0.1"

def old_implementation():
    """Old implementation that is no longer maintained."""
    print("Using legacy code")
    return OLD_CONSTANT

def deprecated_helper():
    """Helper function that should be removed."""
    return os.path.join(sys.path[0], "old_path")

class LegacyProcessor:
    """This processor uses outdated methods."""
    
    def __init__(self):
        self.mode = "legacy"
    
    def process(self, data):
        # Old processing logic
        return f"Legacy: {data}"

# Clean up - this file should be removed entirely