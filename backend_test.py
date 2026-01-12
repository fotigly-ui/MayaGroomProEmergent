#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class MayaGroomProAPITester:
    def __init__(self, base_url="https://groomer-hub-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_client_id = None
        self.test_service_id = None
        self.test_item_id = None
        self.test_appointment_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response.json() if success else response.text, response.status_code

        except Exception as e:
            return False, str(e), 0

    def test_auth_register(self):
        """Test user registration"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@mayatest.com"
        data = {
            "email": test_email,
            "password": "testpass123",
            "business_name": "Test Grooming Business"
        }
        
        success, response, status = self.make_request('POST', 'auth/register', data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log_test("User Registration", True)
            return True
        else:
            self.log_test("User Registration", False, f"Status: {status}, Response: {response}")
            return False

    def test_auth_login(self):
        """Test user login with provided credentials"""
        data = {
            "email": "maya@test.com",
            "password": "test123"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log_test("User Login", True)
            return True
        else:
            self.log_test("User Login", False, f"Status: {status}, Response: {response}")
            return False

    def test_auth_me(self):
        """Test get current user"""
        success, response, status = self.make_request('GET', 'auth/me', None, 200)
        if success and 'id' in response:
            self.user_id = response['id']
            self.log_test("Get Current User", True)
            return True
        else:
            self.log_test("Get Current User", False, f"Status: {status}")
            return False

    def test_settings_get(self):
        """Test get settings"""
        success, response, status = self.make_request('GET', 'settings', None, 200)
        self.log_test("Get Settings", success, f"Status: {status}" if not success else "")
        return success

    def test_settings_update(self):
        """Test update settings including SMS timing"""
        data = {
            "business_name": "Updated Test Business",
            "phone": "+61 400 123 456",
            "email": "test@business.com",
            "gst_enabled": True,
            "gst_rate": 10.0,
            # Test SMS timing settings
            "sms_enabled": True,
            "confirmation_request_value": 3,
            "confirmation_request_unit": "days",
            "reminder_value": 2,
            "reminder_unit": "hours"
        }
        
        success, response, status = self.make_request('PUT', 'settings', data, 200)
        if success:
            # Verify SMS timing fields are saved correctly
            if (response.get('confirmation_request_value') == 3 and 
                response.get('confirmation_request_unit') == 'days' and
                response.get('reminder_value') == 2 and
                response.get('reminder_unit') == 'hours'):
                self.log_test("Update Settings (with SMS timing)", True)
                return True
            else:
                self.log_test("Update Settings (with SMS timing)", False, "SMS timing fields not saved correctly")
                return False
        else:
            self.log_test("Update Settings (with SMS timing)", False, f"Status: {status}")
            return False

    def test_clients_create(self):
        """Test create client"""
        data = {
            "name": "Test Client",
            "phone": "+61 400 111 222",
            "email": "testclient@example.com",
            "address": "123 Test Street, Test City"
        }
        
        success, response, status = self.make_request('POST', 'clients', data, 200)
        if success and 'id' in response:
            self.test_client_id = response['id']
            self.log_test("Create Client", True)
            return True
        else:
            self.log_test("Create Client", False, f"Status: {status}, Response: {response}")
            return False

    def test_clients_list(self):
        """Test list clients"""
        success, response, status = self.make_request('GET', 'clients', None, 200)
        self.log_test("List Clients", success, f"Status: {status}" if not success else "")
        return success

    def test_clients_get(self):
        """Test get specific client"""
        if not self.test_client_id:
            self.log_test("Get Client", False, "No test client ID available")
            return False
            
        success, response, status = self.make_request('GET', f'clients/{self.test_client_id}', None, 200)
        self.log_test("Get Client", success, f"Status: {status}" if not success else "")
        return success

    def test_services_create(self):
        """Test create service"""
        data = {
            "name": "Full Groom",
            "duration": 90,
            "price": 85.00
        }
        
        success, response, status = self.make_request('POST', 'services', data, 200)
        if success and 'id' in response:
            self.test_service_id = response['id']
            self.log_test("Create Service", True)
            return True
        else:
            self.log_test("Create Service", False, f"Status: {status}, Response: {response}")
            return False

    def test_services_list(self):
        """Test list services"""
        success, response, status = self.make_request('GET', 'services', None, 200)
        self.log_test("List Services", success, f"Status: {status}" if not success else "")
        return success

    def test_items_create(self):
        """Test create item"""
        data = {
            "name": "Nail Clipping",
            "price": 15.00
        }
        
        success, response, status = self.make_request('POST', 'items', data, 200)
        if success and 'id' in response:
            self.test_item_id = response['id']
            self.log_test("Create Item", True)
            return True
        else:
            self.log_test("Create Item", False, f"Status: {status}, Response: {response}")
            return False

    def test_items_list(self):
        """Test list items"""
        success, response, status = self.make_request('GET', 'items', None, 200)
        self.log_test("List Items", success, f"Status: {status}" if not success else "")
        return success

    def test_pets_create(self):
        """Test create pet"""
        if not self.test_client_id:
            self.log_test("Create Pet", False, "No test client ID available")
            return False
            
        data = {
            "client_id": self.test_client_id,
            "name": "Buddy",
            "breed": "Golden Retriever",
            "age": "3 years",
            "notes": "Very friendly dog"
        }
        
        success, response, status = self.make_request('POST', 'pets', data, 200)
        self.log_test("Create Pet", success, f"Status: {status}" if not success else "")
        return success

    def test_pets_list(self):
        """Test list pets"""
        success, response, status = self.make_request('GET', 'pets', None, 200)
        self.log_test("List Pets", success, f"Status: {status}" if not success else "")
        return success

    def test_appointments_create(self):
        """Test create appointment"""
        if not self.test_client_id or not self.test_service_id:
            self.log_test("Create Appointment", False, "Missing client or service ID")
            return False
            
        # Create appointment for tomorrow at 10 AM
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Test appointment",
            "pets": [
                {
                    "pet_name": "Buddy",
                    "services": [self.test_service_id],
                    "items": [self.test_item_id] if self.test_item_id else []
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if success and 'id' in response:
            self.test_appointment_id = response['id']
            self.log_test("Create Appointment", True)
            return True
        else:
            self.log_test("Create Appointment", False, f"Status: {status}, Response: {response}")
            return False

    def test_appointments_list(self):
        """Test list appointments"""
        success, response, status = self.make_request('GET', 'appointments', None, 200)
        self.log_test("List Appointments", success, f"Status: {status}" if not success else "")
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        success, response, status = self.make_request('GET', 'dashboard/stats', None, 200)
        self.log_test("Dashboard Stats", success, f"Status: {status}" if not success else "")
        return success

    def test_waitlist_create(self):
        """Test create waitlist entry"""
        if not self.test_client_id:
            self.log_test("Create Waitlist Entry", False, "No test client ID available")
            return False
            
        data = {
            "client_id": self.test_client_id,
            "preferred_services": [self.test_service_id] if self.test_service_id else [],
            "notes": "Available weekday mornings"
        }
        
        success, response, status = self.make_request('POST', 'waitlist', data, 200)
        self.log_test("Create Waitlist Entry", success, f"Status: {status}" if not success else "")
        return success

    def test_waitlist_list(self):
        """Test list waitlist"""
        success, response, status = self.make_request('GET', 'waitlist', None, 200)
        self.log_test("List Waitlist", success, f"Status: {status}" if not success else "")
        return success

    def test_sms_templates_get(self):
        """Test get SMS templates"""
        success, response, status = self.make_request('GET', 'sms/templates', None, 200)
        self.log_test("Get SMS Templates", success, f"Status: {status}" if not success else "")
        return success

    def test_sms_templates_update(self):
        """Test update SMS templates"""
        data = {
            "appointment_booked": {
                "name": "Appointment Booked",
                "template": "Hi {client_name}! Your appointment for {pet_names} at {business_name} is confirmed for {date} at {time}. See you then!",
                "enabled": True
            },
            "confirmation_request": {
                "name": "Confirmation Request", 
                "template": "Hi {client_name}! Please confirm your appointment for {pet_names} on {date} at {time}.",
                "enabled": True
            }
        }
        
        success, response, status = self.make_request('PUT', 'sms/templates', data, 200)
        self.log_test("Update SMS Templates", success, f"Status: {status}" if not success else "")
        return success

    def test_sms_preview(self):
        """Test SMS preview"""
        success, response, status = self.make_request('POST', 'sms/preview?message_type=appointment_booked', {}, 200)
        if success and 'preview' in response:
            self.log_test("SMS Preview", True)
            return True
        else:
            self.log_test("SMS Preview", False, f"Status: {status}, Response: {response}")
            return False

    def test_sms_send(self):
        """Test SMS send (manual mode)"""
        if not self.test_client_id:
            self.log_test("SMS Send", False, "No test client ID available")
            return False
            
        data = {
            "client_id": self.test_client_id,
            "message_type": "confirmation_request",
            "appointment_id": self.test_appointment_id
        }
        
        success, response, status = self.make_request('POST', 'sms/send', data, 200)
        if success and 'status' in response:
            self.log_test("SMS Send", True, f"SMS Status: {response.get('status')}")
            return True
        else:
            self.log_test("SMS Send", False, f"Status: {status}, Response: {response}")
            return False

    def test_sms_messages_list(self):
        """Test list SMS messages"""
        success, response, status = self.make_request('GET', 'sms/messages', None, 200)
        self.log_test("List SMS Messages", success, f"Status: {status}" if not success else "")
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Maya Groom Pro API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        # Try login first, if fails try registration
        if not self.test_auth_login():
            print("Login failed, trying registration...")
            if not self.test_auth_register():
                print("❌ Authentication failed completely. Cannot continue tests.")
                return False

        # Get user info
        if not self.test_auth_me():
            print("❌ Cannot get user info. Cannot continue tests.")
            return False

        # Test all endpoints
        self.test_settings_get()
        self.test_settings_update()
        
        self.test_clients_create()
        self.test_clients_list()
        self.test_clients_get()
        
        self.test_services_create()
        self.test_services_list()
        
        self.test_items_create()
        self.test_items_list()
        
        self.test_pets_create()
        self.test_pets_list()
        
        self.test_appointments_create()
        self.test_appointments_list()
        
        self.test_waitlist_create()
        self.test_waitlist_list()
        
        self.test_dashboard_stats()

        # Test SMS endpoints
        self.test_sms_templates_get()
        self.test_sms_templates_update()
        self.test_sms_preview()
        self.test_sms_send()
        self.test_sms_messages_list()

        # Test Invoice endpoints
        self.test_invoices_create()
        self.test_invoices_list()
        self.test_invoices_get()
        self.test_invoices_from_appointment()
        self.test_invoices_update_status()

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = MayaGroomProAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())