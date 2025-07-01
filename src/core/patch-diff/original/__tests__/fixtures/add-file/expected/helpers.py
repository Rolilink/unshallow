"""
Helper utilities for the application.
"""

def format_name(first_name, last_name):
    """Format a full name from first and last names."""
    return f"{first_name} {last_name}"

def calculate_age(birth_year, current_year=2024):
    """Calculate age based on birth year."""
    return current_year - birth_year

def validate_email(email):
    """Simple email validation."""
    return "@" in email and "." in email