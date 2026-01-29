#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class RecurringAppointmentTester:
    def __init__(self, base_url="https://petapptracker.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test data storage
        self.test_client_id = None
        self.test_service_id = None
        self.recurring_appointment_id = None
        self.recurring_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   📋 {details}")
        else:
            print(f"❌ {name} - {details}")

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

    def setup_auth_and_data(self):
        """Setup authentication and test data"""
        # Login
        data = {
            "email": "frontendtest@test.com",
            "password": "test123"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            print("✅ Authentication successful")
        else:
            print(f"❌ Authentication failed: {status}")
            return False

        # Get user info
        success, response, status = self.make_request('GET', 'auth/me', None, 200)
        if success and 'id' in response:
            self.user_id = response['id']
            print("✅ User info retrieved")
        else:
            print(f"❌ Failed to get user info: {status}")
            return False

        # Create test client
        client_data = {
            "name": "Emma Thompson",
            "phone": "+61 412 345 678",
            "email": "emma.thompson@email.com",
            "address": "45 Maple Street, Brisbane QLD 4000"
        }
        
        success, response, status = self.make_request('POST', 'clients', client_data, 200)
        if success and 'id' in response:
            self.test_client_id = response['id']
            print("✅ Test client created")
        else:
            print(f"❌ Failed to create test client: {status}")
            return False

        # Create test service
        service_data = {
            "name": "Premium Full Groom",
            "duration": 120,
            "price": 95.00
        }
        
        success, response, status = self.make_request('POST', 'services', service_data, 200)
        if success and 'id' in response:
            self.test_service_id = response['id']
            print("✅ Test service created")
        else:
            print(f"❌ Failed to create test service: {status}")
            return False

        return True

    def test_1_create_recurring_series(self):
        """Test 1: Create recurring appointment series (every 2 weeks for 6 months)"""
        print("\n🔄 TEST 1: Creating recurring appointment series...")
        
        # Create recurring appointment starting next week
        start_date = datetime.now() + timedelta(days=7)
        appointment_time = start_date.replace(hour=14, minute=30, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Recurring grooming for Buddy - every 2 weeks",
            "is_recurring": True,
            "recurring_value": 2,
            "recurring_unit": "week",
            "pets": [
                {
                    "pet_name": "Buddy",
                    "services": [self.test_service_id],
                    "items": []
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if success and 'id' in response:
            self.recurring_appointment_id = response['id']
            self.recurring_id = response.get('recurring_id')
            
            # Verify recurring fields
            if (response.get('is_recurring') == True and 
                response.get('recurring_value') == 2 and
                response.get('recurring_unit') == 'week' and
                response.get('recurring_id') is not None):
                
                # Get series count
                series_success, series_response, _ = self.make_request('GET', 'appointments', None, 200)
                if series_success:
                    recurring_appointments = [apt for apt in series_response if apt.get('recurring_id') == self.recurring_id]
                    
                    # Verify date intervals
                    sorted_appointments = sorted(recurring_appointments, key=lambda x: x['date_time'])
                    if len(sorted_appointments) >= 2:
                        first_date = datetime.fromisoformat(sorted_appointments[0]['date_time'].replace('Z', '+00:00'))
                        second_date = datetime.fromisoformat(sorted_appointments[1]['date_time'].replace('Z', '+00:00'))
                        interval_days = (second_date - first_date).days
                        
                        if interval_days == 14:  # 2 weeks
                            self.log_test("Create Recurring Series", True, 
                                        f"Created {len(recurring_appointments)} appointments with correct 14-day intervals")
                            return True
                        else:
                            self.log_test("Create Recurring Series", False, 
                                        f"Incorrect interval: {interval_days} days instead of 14")
                            return False
                    else:
                        self.log_test("Create Recurring Series", False, 
                                    f"Not enough appointments created: {len(sorted_appointments)}")
                        return False
                else:
                    self.log_test("Create Recurring Series", False, "Could not retrieve series")
                    return False
            else:
                self.log_test("Create Recurring Series", False, "Recurring fields not set correctly")
                return False
        else:
            self.log_test("Create Recurring Series", False, f"Status: {status}, Response: {response}")
            return False

    def test_2_edit_single_occurrence_detach(self):
        """Test 2: Edit single occurrence with update_series=false (should detach from series)"""
        print("\n🔄 TEST 2: Editing single occurrence to detach from series...")
        
        if not self.recurring_appointment_id:
            self.log_test("Edit Single Occurrence (Detach)", False, "No recurring appointment ID")
            return False
            
        # Get original appointment
        success, original_appt, status = self.make_request('GET', f'appointments/{self.recurring_appointment_id}', None, 200)
        if not success:
            self.log_test("Edit Single Occurrence (Detach)", False, f"Could not get original: {status}")
            return False
            
        original_recurring_id = original_appt.get('recurring_id')
        
        # Update with update_series=false to detach
        update_data = {
            "notes": "DETACHED: Special one-time grooming with nail trim",
            "update_series": False
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{self.recurring_appointment_id}', update_data, 200)
        if success:
            # Verify detachment
            if (response.get('is_recurring') == False and 
                response.get('recurring_id') is None and
                response.get('recurring_value') is None and
                response.get('recurring_unit') is None):
                
                # Verify rest of series intact
                series_success, series_response, _ = self.make_request('GET', 'appointments', None, 200)
                if series_success:
                    remaining_series = [apt for apt in series_response if apt.get('recurring_id') == original_recurring_id]
                    
                    if len(remaining_series) > 0:
                        # Check first remaining appointment has recurring metadata
                        first_remaining = remaining_series[0]
                        if (first_remaining.get('is_recurring') == True and 
                            first_remaining.get('recurring_id') == original_recurring_id):
                            self.log_test("Edit Single Occurrence (Detach from Series)", True, 
                                        f"Successfully detached. {len(remaining_series)} appointments remain in series")
                            return True
                        else:
                            self.log_test("Edit Single Occurrence (Detach from Series)", False, 
                                        "Remaining appointments lost recurring metadata")
                            return False
                    else:
                        self.log_test("Edit Single Occurrence (Detach from Series)", False, 
                                    "No remaining appointments in series")
                        return False
                else:
                    self.log_test("Edit Single Occurrence (Detach from Series)", False, 
                                "Could not verify remaining series")
                    return False
            else:
                self.log_test("Edit Single Occurrence (Detach from Series)", False, 
                            f"Not properly detached: is_recurring={response.get('is_recurring')}")
                return False
        else:
            self.log_test("Edit Single Occurrence (Detach from Series)", False, f"Status: {status}")
            return False

    def test_3_preserve_recurring_fields_series_update(self):
        """Test 3: Update series without frequency change (should preserve recurring fields)"""
        print("\n🔄 TEST 3: Updating series while preserving recurring fields...")
        
        if not self.recurring_id:
            self.log_test("Preserve Recurring Fields", False, "No recurring series ID")
            return False
            
        # Get one appointment from series
        success, appointments, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Preserve Recurring Fields", False, f"Could not get appointments: {status}")
            return False
            
        series_appointments = [apt for apt in appointments if apt.get('recurring_id') == self.recurring_id]
        if not series_appointments:
            self.log_test("Preserve Recurring Fields", False, "No appointments in series")
            return False
            
        test_appointment = series_appointments[0]
        original_recurring_value = test_appointment.get('recurring_value')
        original_recurring_unit = test_appointment.get('recurring_unit')
        
        # Update series (notes only, no frequency change)
        update_data = {
            "notes": "SERIES UPDATE: Added teeth cleaning to all appointments",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{test_appointment["id"]}', update_data, 200)
        if success:
            # Verify recurring fields preserved
            if (response.get('is_recurring') == True and 
                response.get('recurring_id') == self.recurring_id and
                response.get('recurring_value') == original_recurring_value and
                response.get('recurring_unit') == original_recurring_unit):
                
                # Verify all future appointments updated
                updated_success, updated_appointments, _ = self.make_request('GET', 'appointments', None, 200)
                if updated_success:
                    updated_series = [apt for apt in updated_appointments if apt.get('recurring_id') == self.recurring_id]
                    future_appointments = [apt for apt in updated_series if apt.get('date_time') >= datetime.now().isoformat()]
                    
                    preserved_count = 0
                    updated_count = 0
                    
                    for apt in future_appointments:
                        if (apt.get('is_recurring') == True and 
                            apt.get('recurring_id') == self.recurring_id and
                            apt.get('recurring_value') == original_recurring_value and
                            apt.get('recurring_unit') == original_recurring_unit):
                            preserved_count += 1
                            if apt.get('notes') == "SERIES UPDATE: Added teeth cleaning to all appointments":
                                updated_count += 1
                    
                    if preserved_count == len(future_appointments) and updated_count > 0:
                        self.log_test("Preserve Recurring Fields on Series Update", True, 
                                    f"Updated {updated_count} appointments, all {preserved_count} preserved recurring metadata")
                        return True
                    else:
                        self.log_test("Preserve Recurring Fields on Series Update", False, 
                                    f"Preserved: {preserved_count}/{len(future_appointments)}, Updated: {updated_count}")
                        return False
                else:
                    self.log_test("Preserve Recurring Fields on Series Update", False, 
                                "Could not verify updated series")
                    return False
            else:
                self.log_test("Preserve Recurring Fields on Series Update", False, 
                            "Recurring fields not preserved in response")
                return False
        else:
            self.log_test("Preserve Recurring Fields on Series Update", False, f"Status: {status}")
            return False

    def run_focused_tests(self):
        """Run focused recurring appointment tests"""
        print("🚀 Starting Focused Recurring Appointment Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        if not self.setup_auth_and_data():
            print("❌ Setup failed. Cannot continue tests.")
            return False

        # Run the critical tests
        self.test_1_create_recurring_series()
        self.test_2_edit_single_occurrence_detach()
        self.test_3_preserve_recurring_fields_series_update()

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Focused Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All critical recurring appointment tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} critical tests failed")
            return False

def main():
    tester = RecurringAppointmentTester()
    success = tester.run_focused_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())