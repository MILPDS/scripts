#!/bin/bash

# Check if the user has provided an input file argument
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <input_file>"
    exit 1
fi

# Use the first argument as the input file name
inputFile="$1"

# Check if inputFile exists
if [ ! -f "$inputFile" ]; then
    echo "File not found: $inputFile"
    exit 1
fi

# Process each line of the file
while IFS= read -r line
do
  # Use awk to parse the line and reformat the output
  echo "$line" | awk '{split($7, a, "/"); print $4 ":" a[1]}'
done < "$inputFile"
