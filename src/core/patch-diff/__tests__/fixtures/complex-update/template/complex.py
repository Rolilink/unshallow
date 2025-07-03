import os
import sys
from typing import List, Dict
from pathlib import Path

class DataProcessor:
    """A class for processing various data formats."""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.data = {}
        self.processed_count = 0
    
    def load_config(self) -> Dict:
        """Load configuration from file."""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(self.config_path, 'r') as f:
            return eval(f.read())  # Simple eval for demo
    
    def process_data(self, items: List[str]) -> List[str]:
        """Process a list of data items."""
        results = []
        for item in items:
            if item.strip():
                processed = item.upper().strip()
                results.append(processed)
                self.processed_count += 1
        return results
    
    def save_results(self, results: List[str], output_path: str) -> None:
        """Save processed results to file."""
        with open(output_path, 'w') as f:
            for result in results:
                f.write(f"{result}\n")
    
    def get_stats(self) -> Dict:
        """Get processing statistics."""
        return {
            'processed_count': self.processed_count,
            'config_path': self.config_path
        }

if __name__ == "__main__":
    processor = DataProcessor("config.json")
    data = ["  hello  ", "world", "", "  python  "]
    results = processor.process_data(data)
    processor.save_results(results, "output.txt")
    print(f"Processed {len(results)} items")