#!/usr/bin/env python3
import sys
import os
import subprocess

# Change to test directory
os.chdir('test-patch')

# Run the patch with captured output
try:
    result = subprocess.run(
        ['python3', '../src/core/patch-diff/original/patch_diff.py'],
        input=open('../src/core/patch-diff/__tests__/fixtures/deep-update/patch.txt').read(),
        text=True,
        capture_output=True,
        timeout=30
    )
    
    print("STDOUT:")
    print(repr(result.stdout))
    print("\nSTDERR:")
    print(repr(result.stderr))
    print(f"\nReturn code: {result.returncode}")
    
except subprocess.TimeoutExpired:
    print("Process timed out")
except Exception as e:
    print(f"Error: {e}")