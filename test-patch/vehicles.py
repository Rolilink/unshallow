"""
Vehicle management system with multiple classes having similar method names.
This file is designed to test hierarchical navigation in patch systems.
"""

import datetime
from typing import Optional, Dict, Any


class Car:
    """Car class with standard vehicle operations."""
    
    def __init__(self, make: str, model: str, year: int):
        self.make = make
        self.model = model
        self.year = year
        self.mileage = 0
        self.fuel_level = 100.0
        self.is_running = False
        self.maintenance_due = False
    
    def start(self) -> bool:
        """Start the car engine."""
        if self.fuel_level > 0:
            self.is_running = True
            return True
        return False
    
    def stop(self) -> None:
        """Stop the car engine."""
        self.is_running = False
    
    def drive(self, distance: float) -> bool:
        """Drive the car for a given distance."""
        if not self.is_running:
            return False
        
        fuel_needed = distance * 0.05  # 5% fuel per unit distance
        if self.fuel_level >= fuel_needed:
            self.mileage += distance
            self.fuel_level -= fuel_needed
            
            # Check if maintenance is due
            if self.mileage > 10000:
                self.maintenance_due = True
            
            return True
        return False
    
    def refuel(self, amount: float) -> None:
        """Refuel the car."""
        self.fuel_level = min(100.0, self.fuel_level + amount)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current car status."""
        return {
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "mileage": self.mileage,
            "fuel_level": self.fuel_level,
            "is_running": self.is_running,
            "maintenance_due": self.maintenance_due
        }


class Motorcycle:
    """Motorcycle class with similar operations to Car."""
    
    def __init__(self, make: str, model: str, year: int, engine_size: int):
        self.make = make
        self.model = model
        self.year = year
        self.engine_size = engine_size
        self.mileage = 0
        self.fuel_level = 100.0
        self.is_running = False
        self.maintenance_due = False
    
    def start(self) -> bool:
        """Start the motorcycle engine."""
        if self.fuel_level > 0:
            self.is_running = True
            return True
        return False
    
    def stop(self) -> None:
        """Stop the motorcycle engine."""
        self.is_running = False
    
    def drive(self, distance: float) -> bool:
        """Drive the motorcycle for a given distance."""
        if not self.is_running:
            return False
        
        fuel_needed = distance * 0.03  # 3% fuel per unit distance (more efficient)
        if self.fuel_level >= fuel_needed:
            self.mileage += distance
            self.fuel_level -= fuel_needed
            
            # Check if maintenance is due
            if self.mileage > 8000:
                self.maintenance_due = True
            
            return True
        return False
    
    def refuel(self, amount: float) -> None:
        """Refuel the motorcycle."""
        self.fuel_level = min(100.0, self.fuel_level + amount)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current motorcycle status."""
        return {
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "engine_size": self.engine_size,
            "mileage": self.mileage,
            "fuel_level": self.fuel_level,
            "is_running": self.is_running,
            "maintenance_due": self.maintenance_due
        }


class Truck:
    """Truck class with cargo-specific operations."""
    
    def __init__(self, make: str, model: str, year: int, max_cargo: float):
        self.make = make
        self.model = model
        self.year = year
        self.max_cargo = max_cargo
        self.current_cargo = 0.0
        self.mileage = 0
        self.fuel_level = 100.0
        self.is_running = False
        self.maintenance_due = False
    
    def start(self) -> bool:
        """Start the truck engine."""
        if self.fuel_level > 0:
            self.is_running = True
            return True
        return False
    
    def stop(self) -> None:
        """Stop the truck engine."""
        self.is_running = False
    
    def drive(self, distance: float) -> bool:
        """Drive the truck for a given distance."""
        if not self.is_running:
            return False
        
        # Fuel consumption depends on cargo load
        cargo_factor = 1 + (self.current_cargo / self.max_cargo)
        fuel_needed = distance * 0.08 * cargo_factor  # Base 8% fuel per unit distance
        
        if self.fuel_level >= fuel_needed:
            self.mileage += distance
            self.fuel_level -= fuel_needed
            
            # Check if maintenance is due
            if self.mileage > 15000:
                self.maintenance_due = True
            
            return True
        return False
    
    def refuel(self, amount: float) -> None:
        """Refuel the truck."""
        self.fuel_level = min(100.0, self.fuel_level + amount)
    
    def load_cargo(self, weight: float) -> bool:
        """Load cargo onto the truck."""
        if self.current_cargo + weight <= self.max_cargo:
            self.current_cargo += weight
            return True
        return False
    
    def unload_cargo(self, weight: float) -> bool:
        """Unload cargo from the truck."""
        if weight <= self.current_cargo:
            self.current_cargo -= weight
            return True
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get current truck status."""
        return {
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "max_cargo": self.max_cargo,
            "current_cargo": self.current_cargo,
            "mileage": self.mileage,
            "fuel_level": self.fuel_level,
            "is_running": self.is_running,
            "maintenance_due": self.maintenance_due
        }


class ElectricCar:
    """Electric car with battery-specific operations."""
    
    def __init__(self, make: str, model: str, year: int, battery_capacity: float):
        self.make = make
        self.model = model
        self.year = year
        self.battery_capacity = battery_capacity
        self.battery_level = 100.0
        self.mileage = 0
        self.is_running = False
        self.maintenance_due = False
    
    def start(self) -> bool:
        """Start the electric car."""
        if self.battery_level > 0:
            self.is_running = True
            return True
        return False
    
    def stop(self) -> None:
        """Stop the electric car."""
        self.is_running = False
    
    def drive(self, distance: float) -> bool:
        """Drive the electric car for a given distance."""
        if not self.is_running:
            return False
        
        battery_needed = distance * 0.02  # 2% battery per unit distance
        if self.battery_level >= battery_needed:
            self.mileage += distance
            self.battery_level -= battery_needed
            
            # Check if maintenance is due
            if self.mileage > 12000:
                self.maintenance_due = True
            
            return True
        return False
    
    def charge(self, amount: float) -> None:
        """Charge the electric car battery."""
        self.battery_level = min(100.0, self.battery_level + amount)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current electric car status."""
        return {
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "battery_capacity": self.battery_capacity,
            "battery_level": self.battery_level,
            "mileage": self.mileage,
            "is_running": self.is_running,
            "maintenance_due": self.maintenance_due
        }


# Fleet management functions
def create_fleet():
    """Create a sample fleet of vehicles."""
    return [
        Car("Toyota", "Camry", 2020),
        Motorcycle("Honda", "CBR600RR", 2021, 600),
        Truck("Ford", "F-150", 2019, 1000.0),
        ElectricCar("Tesla", "Model 3", 2022, 75.0)
    ]


def start_all_vehicles(fleet):
    """Start all vehicles in the fleet."""
    results = []
    for vehicle in fleet:
        if vehicle.start():
            results.append(f"{vehicle.make} {vehicle.model} started successfully")
        else:
            results.append(f"{vehicle.make} {vehicle.model} failed to start")
    return results