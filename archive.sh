#!/bin/bash

# --- Configuration ---
OUTPUT_FILE="output.txt"
# Use a highly unlikely separator to prevent collisions with file content
SEPARATOR="--- EOF CONTENT ---" 
# ---------------------

# Function to archive files based on user choice (non-recursive or recursive)
archive_directory() {
    local target_dir=$1

    if [ -z "$target_dir" ] || [ ! -d "$target_dir" ]; then
        echo "Error: Directory '$target_dir' not found or not specified."
        echo "Usage: $0 archive <directory>"
        exit 1
    fi
    
    # Prompt for recursion choice
    read -r -p "Archive files recursively (Y/n)? " choice
    
    local find_command
    if [[ "$choice" =~ ^[Yy]$ || -z "$choice" ]]; then
        echo "Archiving recursively..."
        find_command="find \"$target_dir\" -type f"
    else
        echo "Archiving only files directly in '$target_dir'..."
        # Find only regular files immediately within the directory (depth 1)
        find_command="find \"$target_dir\" -maxdepth 1 -type f"
    fi

    echo "Archiving to '$OUTPUT_FILE'..."
    
    # Empty the output file before starting
    > "$OUTPUT_FILE"

    # Execute the determined find command and loop through files
    eval "$find_command" | while read -r filepath; do
        # 1. Print the filename and its size
        echo "File: $filepath" >> "$OUTPUT_FILE"
        echo "Size: $(stat -c %s "$filepath")" >> "$OUTPUT_FILE"
        echo "$SEPARATOR" >> "$OUTPUT_FILE"
        
        # 2. Print the file content
        cat "$filepath" >> "$OUTPUT_FILE"
        
        # 3. Print the unique EOF separator
        echo -e "\n$SEPARATOR\n" >> "$OUTPUT_FILE"
    done
    
    echo "Archive complete. Total files processed: $(eval "$find_command" | wc -l)"
}

# Function to restore files and directory structure (Unchanged from original)
restore_directory() {
    local archive_file=$1
    local line
    local current_filepath=""
    local capturing_content=0

    if [ -z "$archive_file" ] || [ ! -f "$archive_file" ]; then
        echo "Error: Archive file '$archive_file' not found."
        echo "Usage: $0 restore <archive_file>"
        exit 1
    fi

    echo "Restoring files and directory structure from '$archive_file'..."
    
    # Read the archive file line by line
    while IFS= read -r line; do
        
        if [[ $line == File:\ * ]]; then
            # Found a new file block
            current_filepath="${line#File: }"
            current_filepath=$(echo "$current_filepath" | tr -d '\r') # Remove potential Windows-style carriage return
            echo "Processing: $current_filepath"
            capturing_content=0
            
            # Create the directory structure for the file
            mkdir -p "$(dirname "$current_filepath")"
            
            # Start a new file, discarding old content if any exists
            > "$current_filepath"
            
        elif [[ $line == Size:\ * ]]; then
            # Ignore size line for restoration
            continue

        elif [[ $line == "$SEPARATOR" ]]; then
            if [ $capturing_content -eq 0 ]; then
                # This is the separator after metadata, start capturing content
                capturing_content=1
            else
                # This is the separator after content, stop capturing
                capturing_content=0
            fi

        elif [ $capturing_content -eq 1 ]; then
            # Append the line to the current file
            echo "$line" >> "$current_filepath"
        fi
        
    done < "$archive_file"

    echo "Restoration complete."
}

# --- Main Logic ---

case "$1" in
    archive)
        archive_directory "$2"
        ;;
    restore)
        restore_directory "${2:-$OUTPUT_FILE}"
        ;;
    *)
        echo "Usage:"
        echo "  To ARCHIVE a directory: $0 archive <directory_to_archive>"
        echo "  To RESTORE files:     $0 restore [archive_file] (defaults to $OUTPUT_FILE)"
        ;;
esac

