#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class CriticalRecurringAppointmentTester:
    def __init__(self, base_url="https://pawsched-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_client_id = None
        self.test_service_id = None
        self.test_appointment_id = None
        self.recurring_id = None

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

    def setup_test_data(self):
        """Setup required test data"""
        print("🔧 Setting up test data...")
        
        # Login or register
        login_data = {
            "email": "maya@test.com",
            "password": "test123"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', login_data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            print("✅ Logged in successfully")
        else:
            # Try registration
            register_data = {
                "email": f"test_{uuid.uuid4().hex[:8]}@mayatest.com",
                "password": "testpass123",
                "business_name": "Test Grooming Business"
            }
            success, response, status = self.make_request('POST', 'auth/register', register_data, 200)
            if success and 'access_token' in response:
                self.token = response['access_token']
                print("✅ Registered and logged in successfully")
            else:
                print(f"❌ Authentication failed: {response}")
                return False

        # Get user info
        success, response, status = self.make_request('GET', 'auth/me', None, 200)
        if success and 'id' in response:
            self.user_id = response['id']
            print("✅ Got user info")
        else:
            print(f"❌ Failed to get user info: {response}")
            return False

        # Create test client
        client_data = {
            "name": "Sarah Johnson",
            "phone": "+61 400 555 123",
            "email": "sarah.johnson@example.com",
            "address": "456 Pet Street, Melbourne VIC 3000"
        }
        
        success, response, status = self.make_request('POST', 'clients', client_data, 200)
        if success and 'id' in response:
            self.test_client_id = response['id']
            print("✅ Created test client")
        else:
            print(f"❌ Failed to create client: {response}")
            return False

        # Create test service
        service_data = {
            "name": "Full Grooming Service",
            "duration": 120,
            "price": 95.00
        }
        
        success, response, status = self.make_request('POST', 'services', service_data, 200)
        if success and 'id' in response:
            self.test_service_id = response['id']
            print("✅ Created test service")
        else:
            print(f"❌ Failed to create service: {response}")
            return False

        return True

    def test_1_create_non_recurring_appointment(self):
        """Test 1: Create a NON-recurring appointment"""
        print("\n📅 Test 1: Creating NON-recurring appointment...")
        
        # Create appointment for next week at 2 PM
        next_week = datetime.now() + timedelta(days=7)
        appointment_time = next_week.replace(hour=14, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Initial non-recurring appointment for Bella",
            "is_recurring": False,
            "pets": [
                {
                    "pet_name": "Bella",
                    "services": [self.test_service_id]
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if success and 'id' in response:
            self.test_appointment_id = response['id']
            # Verify it's NOT recurring
            if not response.get('is_recurring', False):
                self.log_test("Create Non-Recurring Appointment", True, f"Appointment ID: {self.test_appointment_id}")
                print(f"   📋 Created appointment: {self.test_appointment_id}")
                print(f"   📅 Date/Time: {response.get('date_time')}")
                print(f"   🔄 Is Recurring: {response.get('is_recurring')}")
                return True
            else:
                self.log_test("Create Non-Recurring Appointment", False, "Appointment was marked as recurring")
                return False
        else:
            self.log_test("Create Non-Recurring Appointment", False, f"Status: {status}, Response: {response}")
            return False

    def test_2_update_to_recurring(self):
        """Test 2: Update the NON-recurring appointment to make it recurring"""
        print("\n🔄 Test 2: Converting to recurring appointment...")
        
        if not self.test_appointment_id:
            self.log_test("Update Appointment to Recurring", False, "No appointment ID available")
            return False

        # Get the original appointment first
        success, original_appt, status = self.make_request('GET', f'appointments/{self.test_appointment_id}', None, 200)
        if not success:
            self.log_test("Update Appointment to Recurring", False, f"Could not fetch original appointment: {status}")
            return False

        print(f"   📋 Original appointment: {original_appt.get('id')}")
        print(f"   📅 Original date: {original_appt.get('date_time')}")
        print(f"   🔄 Original recurring: {original_appt.get('is_recurring')}")

        # Update to make it recurring (every 1 week)
        update_data = {
            "date_time": original_appt.get('date_time'),  # Keep same date/time
            "notes": "Updated to recurring - every week for Bella",
            "is_recurring": True,
            "recurring_value": 1,
            "recurring_unit": "week",
            "pets": original_appt.get('pets', [])  # Keep same pets/services
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{self.test_appointment_id}', update_data, 200)
        if success:
            # Verify the update worked
            if (response.get('is_recurring') == True and 
                response.get('recurring_value') == 1 and 
                response.get('recurring_unit') == 'week' and
                response.get('recurring_id')):
                
                self.recurring_id = response.get('recurring_id')
                self.log_test("Update Appointment to Recurring", True, f"Recurring ID: {self.recurring_id}")
                print(f"   ✅ Successfully converted to recurring")
                print(f"   🆔 Recurring ID: {self.recurring_id}")
                print(f"   🔄 Recurring: {response.get('recurring_value')} {response.get('recurring_unit')}")
                return True
            else:
                self.log_test("Update Appointment to Recurring", False, f"Recurring fields not set correctly: {response}")
                return False
        else:
            self.log_test("Update Appointment to Recurring", False, f"Status: {status}, Response: {response}")
            return False

    def test_3_verify_multiple_appointments_created(self):
        """Test 3: Verify multiple appointments were created with same recurring_id"""
        print("\n📊 Test 3: Verifying multiple recurring appointments created...")
        
        if not self.recurring_id:
            self.log_test("Verify Multiple Appointments Created", False, "No recurring ID available")
            return False

        # Get all appointments to find ones with our recurring_id
        success, response, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Verify Multiple Appointments Created", False, f"Could not fetch appointments: {status}")
            return False

        # Filter appointments by recurring_id
        recurring_appointments = [appt for appt in response if appt.get('recurring_id') == self.recurring_id]
        
        if len(recurring_appointments) > 1:
            self.log_test("Verify Multiple Appointments Created", True, f"Found {len(recurring_appointments)} recurring appointments")
            print(f"   📈 Total recurring appointments: {len(recurring_appointments)}")
            
            # Verify they have different dates
            dates = [appt.get('date_time') for appt in recurring_appointments]
            unique_dates = set(dates)
            
            if len(unique_dates) == len(dates):
                print(f"   ✅ All appointments have different dates")
                
                # Show first few appointments
                for i, appt in enumerate(recurring_appointments[:5]):
                    appt_date = datetime.fromisoformat(appt.get('date_time').replace('Z', '+00:00'))
                    print(f"   📅 Appointment {i+1}: {appt_date.strftime('%Y-%m-%d %H:%M')} (ID: {appt.get('id')[:8]}...)")
                
                # Verify weekly intervals
                if len(recurring_appointments) >= 2:
                    date1 = datetime.fromisoformat(recurring_appointments[0].get('date_time').replace('Z', '+00:00'))
                    date2 = datetime.fromisoformat(recurring_appointments[1].get('date_time').replace('Z', '+00:00'))
                    diff = date2 - date1
                    
                    if diff.days == 7:
                        print(f"   ✅ Correct weekly interval: {diff.days} days")
                        return True
                    else:
                        self.log_test("Verify Multiple Appointments Created", False, f"Incorrect interval: {diff.days} days instead of 7")
                        return False
                
                return True
            else:
                self.log_test("Verify Multiple Appointments Created", False, "Some appointments have duplicate dates")
                return False
        else:
            self.log_test("Verify Multiple Appointments Created", False, f"Only found {len(recurring_appointments)} appointments")
            return False

    def test_4_series_update(self):
        """Test 4: Update entire series with update_series=true"""
        print("\n🔄 Test 4: Testing series update functionality...")
        
        if not self.test_appointment_id or not self.recurring_id:
            self.log_test("Series Update Functionality", False, "Missing appointment or recurring ID")
            return False

        # Update the series with new notes
        update_data = {
            "notes": "UPDATED SERIES - All future appointments for Bella's weekly grooming",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{self.test_appointment_id}', update_data, 200)
        if not success:
            self.log_test("Series Update Functionality", False, f"Update failed: Status {status}, Response: {response}")
            return False

        # Verify all future appointments in the series were updated
        success, all_appointments, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Series Update Functionality", False, f"Could not fetch appointments: {status}")
            return False

        # Get current time for comparison
        current_time = datetime.now().isoformat()
        
        # Filter for future appointments in this series
        future_series_appointments = [
            appt for appt in all_appointments 
            if (appt.get('recurring_id') == self.recurring_id and 
                appt.get('date_time', '') >= current_time)
        ]
        
        # Check if they all have the updated notes
        updated_count = 0
        for appt in future_series_appointments:
            if "UPDATED SERIES" in appt.get('notes', ''):
                updated_count += 1

        if updated_count > 0 and updated_count == len(future_series_appointments):
            self.log_test("Series Update Functionality", True, f"Updated {updated_count} future appointments")
            print(f"   ✅ Successfully updated {updated_count} future appointments in series")
            return True
        else:
            self.log_test("Series Update Functionality", False, f"Only {updated_count}/{len(future_series_appointments)} appointments updated")
            return False

    def test_5_series_delete(self):
        """Test 5: Delete entire series with delete_series=true"""
        print("\n🗑️ Test 5: Testing series delete functionality...")
        
        if not self.test_appointment_id or not self.recurring_id:
            self.log_test("Series Delete Functionality", False, "Missing appointment or recurring ID")
            return False

        # Count appointments before deletion
        success, all_appointments_before, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Series Delete Functionality", False, f"Could not fetch appointments before delete: {status}")
            return False

        current_time = datetime.now().isoformat()
        future_appointments_before = [
            appt for appt in all_appointments_before 
            if (appt.get('recurring_id') == self.recurring_id and 
                appt.get('date_time', '') >= current_time)
        ]
        
        print(f"   📊 Future appointments before delete: {len(future_appointments_before)}")

        # Delete the series
        success, response, status = self.make_request('DELETE', f'appointments/{self.test_appointment_id}?delete_series=true', None, 200)
        if not success:
            self.log_test("Series Delete Functionality", False, f"Delete failed: Status {status}, Response: {response}")
            return False

        print(f"   📝 Delete response: {response}")

        # Verify appointments were deleted
        success, all_appointments_after, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Series Delete Functionality", False, f"Could not fetch appointments after delete: {status}")
            return False

        future_appointments_after = [
            appt for appt in all_appointments_after 
            if (appt.get('recurring_id') == self.recurring_id and 
                appt.get('date_time', '') >= current_time)
        ]
        
        print(f"   📊 Future appointments after delete: {len(future_appointments_after)}")

        if len(future_appointments_after) == 0:
            self.log_test("Series Delete Functionality", True, f"Successfully deleted all future appointments")
            print(f"   ✅ All future appointments in series deleted")
            return True
        else:
            self.log_test("Series Delete Functionality", False, f"Still found {len(future_appointments_after)} future appointments")
            return False

    def test_6_standard_crud_operations(self):
        """Test 6: Standard CRUD operations on non-recurring appointments"""
        print("\n📝 Test 6: Testing standard CRUD operations...")
        
        # Create a simple non-recurring appointment
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=11, minute=30, second=0, microsecond=0)
        
        create_data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Standard CRUD test appointment",
            "is_recurring": False,
            "pets": [
                {
                    "pet_name": "Max",
                    "services": [self.test_service_id]
                }
            ]
        }
        
        # CREATE
        success, create_response, status = self.make_request('POST', 'appointments', create_data, 200)
        if not success or 'id' not in create_response:
            self.log_test("Standard CRUD - Create", False, f"Create failed: {status}")
            return False
        
        crud_appointment_id = create_response['id']
        print(f"   ✅ Created appointment: {crud_appointment_id}")

        # UPDATE (change notes)
        update_data = {
            "notes": "UPDATED - Standard CRUD test appointment with new notes"
        }
        
        success, update_response, status = self.make_request('PUT', f'appointments/{crud_appointment_id}', update_data, 200)
        if not success:
            self.log_test("Standard CRUD - Update", False, f"Update failed: {status}")
            return False
        
        if "UPDATED" in update_response.get('notes', ''):
            print(f"   ✅ Updated appointment notes")
        else:
            self.log_test("Standard CRUD - Update", False, "Notes not updated correctly")
            return False

        # READ (get specific appointment)
        success, read_response, status = self.make_request('GET', f'appointments/{crud_appointment_id}', None, 200)
        if not success:
            self.log_test("Standard CRUD - Read", False, f"Read failed: {status}")
            return False
        
        if read_response.get('id') == crud_appointment_id:
            print(f"   ✅ Read appointment successfully")
        else:
            self.log_test("Standard CRUD - Read", False, "Read returned wrong appointment")
            return False

        # DELETE
        success, delete_response, status = self.make_request('DELETE', f'appointments/{crud_appointment_id}', None, 200)
        if not success:
            self.log_test("Standard CRUD - Delete", False, f"Delete failed: {status}")
            return False
        
        # Verify deletion
        success, verify_response, status = self.make_request('GET', f'appointments/{crud_appointment_id}', None, 404)
        if success or status != 404:
            self.log_test("Standard CRUD - Delete Verification", False, "Appointment still exists after deletion")
            return False
        
        print(f"   ✅ Deleted appointment successfully")
        
        self.log_test("Standard CRUD Operations", True, "All CRUD operations successful")
        return True

    def run_critical_tests(self):
        """Run all critical recurring appointment tests"""
        print("🚀 Starting Critical Recurring Appointment Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Setup test data
        if not self.setup_test_data():
            print("❌ Failed to setup test data. Cannot continue.")
            return False

        print("\n" + "=" * 60)
        print("🔥 CRITICAL RECURRING APPOINTMENT TESTS")
        print("=" * 60)

        # Run the critical tests in sequence
        test_results = []
        
        test_results.append(self.test_1_create_non_recurring_appointment())
        test_results.append(self.test_2_update_to_recurring())
        test_results.append(self.test_3_verify_multiple_appointments_created())
        test_results.append(self.test_4_series_update())
        test_results.append(self.test_5_series_delete())
        test_results.append(self.test_6_standard_crud_operations())

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 CRITICAL TEST RESULTS: {self.tests_passed}/{self.tests_run} passed")
        print("=" * 60)
        
        if all(test_results):
            print("🎉 ALL CRITICAL TESTS PASSED!")
            print("✅ Recurring appointment conversion works correctly")
            print("✅ Multiple appointments created with proper intervals")
            print("✅ Series update functionality works")
            print("✅ Series delete functionality works")
            print("✅ Standard CRUD operations work")
            return True
        else:
            failed_tests = [i+1 for i, result in enumerate(test_results) if not result]
            print(f"⚠️ CRITICAL TESTS FAILED: {failed_tests}")
            return False

def main():
    tester = CriticalRecurringAppointmentTester()
    success = tester.run_critical_tests()
    
    # Save detailed results
    with open('/app/critical_recurring_test_results.json', 'w') as f:
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