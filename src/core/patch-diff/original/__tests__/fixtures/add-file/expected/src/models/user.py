"""
User model for the application.
"""

class User:
    """Represents a user in the system."""
    
    def __init__(self, username, email, age=None):
        self.username = username
        self.email = email
        self.age = age
        self.is_active = True
    
    def deactivate(self):
        """Deactivate the user account."""
        self.is_active = False
    
    def activate(self):
        """Activate the user account."""
        self.is_active = True
    
    def __repr__(self):
        return f"User(username='{self.username}', email='{self.email}', is_active={self.is_active})"