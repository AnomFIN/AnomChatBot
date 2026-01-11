"""
Basic validation tests for Web GUI implementation
"""
import ast
import os
import sys

def test_python_syntax():
    """Test Python files have valid syntax"""
    print("Testing Python syntax...")
    files = ['chatbotserver.py', 'main.py']
    
    for filename in files:
        try:
            with open(filename, 'r') as f:
                ast.parse(f.read())
            print(f"  ✓ {filename}")
        except SyntaxError as e:
            print(f"  ✗ {filename}: {e}")
            return False
    
    return True


def test_web_files_exist():
    """Test web GUI files exist"""
    print("\nTesting web GUI files...")
    files = [
        'web/webgui.html',
        'web/webgui.css',
        'web/webgui.js'
    ]
    
    for filename in files:
        if os.path.exists(filename):
            print(f"  ✓ {filename}")
        else:
            print(f"  ✗ {filename} not found")
            return False
    
    return True


def test_html_structure():
    """Test HTML has required elements"""
    print("\nTesting HTML structure...")
    
    with open('web/webgui.html', 'r') as f:
        content = f.read()
    
    required = [
        '<!DOCTYPE html>',
        '<html',
        '</html>',
        'webgui.css',
        'webgui.js',
        'socket.io',  # WebSocket support
        'conversations-list',  # Conversations sidebar
        'messages-container',  # Messages area
        'message-input',  # Input field
        'settings-modal',  # Settings
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_css_structure():
    """Test CSS has required styles"""
    print("\nTesting CSS structure...")
    
    with open('web/webgui.css', 'r') as f:
        content = f.read()
    
    required = [
        ':root',  # CSS variables
        '.header',
        '.sidebar',
        '.chat-area',
        '.message',
        '.modal',
        '@keyframes',  # Animations
        '@media',  # Responsive design
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_js_structure():
    """Test JavaScript has required functions"""
    print("\nTesting JavaScript structure...")
    
    with open('web/webgui.js', 'r') as f:
        content = f.read()
    
    required = [
        'loadStatus',
        'loadConversations',
        'sendMessage',
        'socket',  # WebSocket variable
        'API_BASE',
        'fetch',  # API calls
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_server_endpoints():
    """Test server has required endpoints"""
    print("\nTesting server endpoints...")
    
    with open('chatbotserver.py', 'r') as f:
        content = f.read()
    
    required = [
        '@app.route(\'/\')',  # Main page
        '@app.route(\'/api/status\')',
        '@app.route(\'/api/conversations\')',
        '@app.route(\'/api/messages',
        '@app.route(\'/api/send\'',
        '@app.route(\'/api/config\'',
        '@socketio.on(\'connect\')',  # WebSocket
        'Flask',
        'SocketIO',
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_main_integration():
    """Test main.py integrates web GUI"""
    print("\nTesting main.py integration...")
    
    with open('main.py', 'r') as f:
        content = f.read()
    
    required = [
        'enable_telegram',
        'WEB_GUI_ENABLED',
        'chatbotserver',
        'web_thread',
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_env_example():
    """Test .env.example has web GUI settings"""
    print("\nTesting .env.example...")
    
    with open('.env.example', 'r') as f:
        content = f.read()
    
    required = [
        'WEB_GUI_ENABLED',
        'WEB_GUI_HOST',
        'WEB_GUI_PORT',
        'TELEGRAM_ENABLED',
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def test_requirements():
    """Test requirements.txt has web GUI dependencies"""
    print("\nTesting requirements.txt...")
    
    with open('requirements.txt', 'r') as f:
        content = f.read()
    
    required = [
        'Flask',
        'Flask-CORS',
        'Flask-SocketIO',
        'python-socketio',
    ]
    
    for item in required:
        if item in content:
            print(f"  ✓ Contains '{item}'")
        else:
            print(f"  ✗ Missing '{item}'")
            return False
    
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("Web GUI Implementation Validation")
    print("=" * 60)
    
    tests = [
        test_python_syntax,
        test_web_files_exist,
        test_html_structure,
        test_css_structure,
        test_js_structure,
        test_server_endpoints,
        test_main_integration,
        test_env_example,
        test_requirements,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"\n✗ Test failed with error: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print(f"Results: {sum(results)}/{len(results)} tests passed")
    print("=" * 60)
    
    if all(results):
        print("\n✅ All validation tests passed!")
        return 0
    else:
        print("\n❌ Some validation tests failed.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
