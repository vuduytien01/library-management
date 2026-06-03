import re

file_path = r'c:\Users\tien2004\Downloads\library-app\app\(admin)\system.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all styles.X references
used_styles = set(re.findall(r'styles\.([a-zA-Z0-9_]+)', content))

# Find all definitions in StyleSheet.create
# This is a bit simplified but should work for standard react-native styles
stylesheet_match = re.search(r'const styles = StyleSheet\.create\({(.*?)}\);', content, re.DOTALL)
if stylesheet_match:
    stylesheet_content = stylesheet_match.group(1)
    defined_styles = set(re.findall(r'([a-zA-Z0-9_]+)\s*:', stylesheet_content))
    
    missing = used_styles - defined_styles
    print(f"Missing styles: {missing}")
    
    unused = defined_styles - used_styles
    # print(f"Unused styles: {unused}")
else:
    print("Could not find StyleSheet.create")
