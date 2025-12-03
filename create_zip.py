import zipfile
import os

def zip_files(output_filename):
    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add the PHP file
        zipf.write('bicicolombia-form.php', 'bicicolombia-form.php')
        
        # Add the dist directory
        for root, dirs, files in os.walk('dist'):
            for file in files:
                file_path = os.path.join(root, file)
                # Force forward slashes for the archive name
                archive_name = file_path.replace(os.sep, '/')
                zipf.write(file_path, archive_name)
                print(f"Adding {archive_name}")

if __name__ == '__main__':
    zip_files('bicicolombia-form.zip')
    print("Zip created successfully with forward slashes.")
