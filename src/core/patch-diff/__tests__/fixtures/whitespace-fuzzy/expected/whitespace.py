def calculate_result(x, y):  
    """Calculate result with trailing whitespace and inconsistent indentation."""
    
    # Added validation
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        raise ValueError("Both x and y must be numbers")
    
    if x > 0:
        result = x + y
    else:
      result = x - y  
    
    # Some comment with trailing space  
    
    return result


def process_data(items):
	"""Process data with mixed tabs and spaces for indentation."""
        
	total = 0
  for item in items:  
		if item > 10:
            total += item * 2
        else:
			total += item
            
    
	return total  


def main():
    print("Starting calculation")  
    
    data = [1, 15, 8, 25]    
    result = process_data(data)
    
    
    final = calculate_result(result, 5)
    print(f"Final result: {final}")


if __name__ == "__main__":
    main()