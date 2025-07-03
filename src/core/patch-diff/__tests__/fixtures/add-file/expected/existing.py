"""
Existing module that contains basic functionality.
This file should remain unchanged during patch application.
"""

def existing_function():
    """An existing function that was here before."""
    return "Hello from existing module"

class ExistingClass:
    """An existing class."""
    
    def __init__(self):
        self.value = 42
    
    def method(self):
        return f"Value is {self.value}"

if __name__ == "__main__":
    print(existing_function())