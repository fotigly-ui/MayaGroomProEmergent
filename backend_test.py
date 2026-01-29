#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class MayaGroomProAPITester:
    def __init__(self, base_url="https://petapptracker.preview.emergentagent.com"):
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
        self.test_invoice_id = None

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
            "email": "frontendtest@test.com",
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

    def test_invoices_create(self):
        """Test create invoice"""
        if not self.test_client_id:
            self.log_test("Create Invoice", False, "No test client ID available")
            return False
            
        data = {
            "client_id": self.test_client_id,
            "items": [
                {
                    "name": "Full Groom Service",
                    "quantity": 1,
                    "unit_price": 85.00,
                    "total": 85.00
                },
                {
                    "name": "Nail Clipping",
                    "quantity": 1,
                    "unit_price": 15.00,
                    "total": 15.00
                }
            ],
            "notes": "Test invoice creation",
            "due_date": (datetime.now() + timedelta(days=30)).isoformat()
        }
        
        success, response, status = self.make_request('POST', 'invoices', data, 200)
        if success and 'id' in response:
            self.test_invoice_id = response['id']
            # Verify GST calculation
            expected_subtotal = 100.00
            expected_gst = 10.00  # 10% GST
            expected_total = 110.00
            
            if (response.get('subtotal') == expected_subtotal and 
                response.get('gst_amount') == expected_gst and
                response.get('total') == expected_total):
                self.log_test("Create Invoice (with GST calculation)", True)
                return True
            else:
                self.log_test("Create Invoice", False, f"GST calculation incorrect: subtotal={response.get('subtotal')}, gst={response.get('gst_amount')}, total={response.get('total')}")
                return False
        else:
            self.log_test("Create Invoice", False, f"Status: {status}, Response: {response}")
            return False

    def test_invoices_list(self):
        """Test list invoices"""
        success, response, status = self.make_request('GET', 'invoices', None, 200)
        self.log_test("List Invoices", success, f"Status: {status}" if not success else "")
        return success

    def test_invoices_get(self):
        """Test get specific invoice"""
        if not self.test_invoice_id:
            self.log_test("Get Invoice", False, "No test invoice ID available")
            return False
            
        success, response, status = self.make_request('GET', f'invoices/{self.test_invoice_id}', None, 200)
        self.log_test("Get Invoice", success, f"Status: {status}" if not success else "")
        return success

    def test_invoices_from_appointment(self):
        """Test create invoice from appointment"""
        if not self.test_appointment_id:
            self.log_test("Create Invoice from Appointment", False, "No test appointment ID available")
            return False
            
        success, response, status = self.make_request('POST', f'invoices/from-appointment/{self.test_appointment_id}', {}, 200)
        if success and 'id' in response and 'invoice_number' in response:
            self.log_test("Create Invoice from Appointment", True, f"Invoice: {response.get('invoice_number')}")
            return True
        else:
            self.log_test("Create Invoice from Appointment", False, f"Status: {status}, Response: {response}")
            return False

    def test_invoices_update_status(self):
        """Test update invoice status"""
        if not self.test_invoice_id:
            self.log_test("Update Invoice Status", False, "No test invoice ID available")
            return False
            
        data = {
            "status": "sent"
        }
        
        success, response, status = self.make_request('PUT', f'invoices/{self.test_invoice_id}', data, 200)
        if success and response.get('status') == 'sent':
            self.log_test("Update Invoice Status", True)
            return True
        else:
            self.log_test("Update Invoice Status", False, f"Status: {status}, Response: {response}")
            return False

    def test_invoices_filter_by_status(self):
        """Test filter invoices by status"""
        success, response, status = self.make_request('GET', 'invoices?status=sent', None, 200)
        self.log_test("Filter Invoices by Status", success, f"Status: {status}" if not success else "")
        return success

    def test_recurring_appointments_create(self):
        """Test create recurring appointment series"""
        if not self.test_client_id or not self.test_service_id:
            self.log_test("Create Recurring Appointment", False, "Missing client or service ID")
            return False
            
        # Create recurring appointment (every 2 weeks for 6 months)
        start_date = datetime.now() + timedelta(days=7)  # Start next week
        appointment_time = start_date.replace(hour=14, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Recurring grooming appointment",
            "is_recurring": True,
            "recurring_value": 2,
            "recurring_unit": "week",
            "pets": [
                {
                    "pet_name": "Max",
                    "services": [self.test_service_id],
                    "items": []
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if success and 'id' in response:
            self.recurring_appointment_id = response['id']
            self.recurring_id = response.get('recurring_id')
            
            # Verify recurring fields are set correctly
            if (response.get('is_recurring') == True and 
                response.get('recurring_value') == 2 and
                response.get('recurring_unit') == 'week' and
                response.get('recurring_id') is not None):
                
                # Get all appointments in the series to verify count
                series_success, series_response, _ = self.make_request('GET', f'appointments?start_date={appointment_time.date().isoformat()}', None, 200)
                if series_success:
                    recurring_appointments = [apt for apt in series_response if apt.get('recurring_id') == self.recurring_id]
                    if len(recurring_appointments) >= 10:  # Should have many appointments for 6+ months
                        self.log_test("Create Recurring Appointment Series", True, f"Created {len(recurring_appointments)} recurring appointments")
                        return True
                    else:
                        self.log_test("Create Recurring Appointment Series", False, f"Only {len(recurring_appointments)} appointments created, expected more")
                        return False
                else:
                    self.log_test("Create Recurring Appointment Series", False, "Could not verify series count")
                    return False
            else:
                self.log_test("Create Recurring Appointment Series", False, "Recurring fields not set correctly")
                return False
        else:
            self.log_test("Create Recurring Appointment Series", False, f"Status: {status}, Response: {response}")
            return False

    def test_edit_single_occurrence_detach(self):
        """Test editing single occurrence of recurring appointment (detach from series)"""
        if not hasattr(self, 'recurring_appointment_id') or not self.recurring_appointment_id:
            self.log_test("Edit Single Occurrence (Detach)", False, "No recurring appointment ID available")
            return False
            
        # Get the original appointment to verify it's recurring
        success, original_appt, status = self.make_request('GET', f'appointments/{self.recurring_appointment_id}', None, 200)
        if not success:
            self.log_test("Edit Single Occurrence (Detach)", False, f"Could not get original appointment: {status}")
            return False
            
        if not original_appt.get('is_recurring'):
            self.log_test("Edit Single Occurrence (Detach)", False, "Original appointment is not recurring")
            return False
            
        original_recurring_id = original_appt.get('recurring_id')
        
        # Update single occurrence with update_series=false (should detach)
        update_data = {
            "notes": "Updated single occurrence - detached from series",
            "update_series": False
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{self.recurring_appointment_id}', update_data, 200)
        if success:
            # Verify the appointment is now detached (not recurring)
            if (response.get('is_recurring') == False and 
                response.get('recurring_id') is None and
                response.get('recurring_value') is None and
                response.get('recurring_unit') is None and
                response.get('notes') == "Updated single occurrence - detached from series"):
                
                # Verify the rest of the series still exists with original recurring_id
                series_success, series_response, _ = self.make_request('GET', 'appointments', None, 200)
                if series_success:
                    remaining_series = [apt for apt in series_response if apt.get('recurring_id') == original_recurring_id]
                    if len(remaining_series) > 0:
                        # Verify remaining appointments still have recurring metadata
                        first_remaining = remaining_series[0]
                        if (first_remaining.get('is_recurring') == True and 
                            first_remaining.get('recurring_id') == original_recurring_id):
                            self.log_test("Edit Single Occurrence (Detach from Series)", True, f"Successfully detached appointment, {len(remaining_series)} appointments remain in series")
                            return True
                        else:
                            self.log_test("Edit Single Occurrence (Detach from Series)", False, "Remaining series appointments lost recurring metadata")
                            return False
                    else:
                        self.log_test("Edit Single Occurrence (Detach from Series)", False, "No remaining appointments in series found")
                        return False
                else:
                    self.log_test("Edit Single Occurrence (Detach from Series)", False, "Could not verify remaining series")
                    return False
            else:
                self.log_test("Edit Single Occurrence (Detach from Series)", False, f"Appointment not properly detached: is_recurring={response.get('is_recurring')}, recurring_id={response.get('recurring_id')}")
                return False
        else:
            self.log_test("Edit Single Occurrence (Detach from Series)", False, f"Status: {status}, Response: {response}")
            return False

    def test_preserve_recurring_fields_on_series_update(self):
        """Test that recurring fields persist when updating series without frequency change"""
        if not hasattr(self, 'recurring_id') or not self.recurring_id:
            self.log_test("Preserve Recurring Fields on Series Update", False, "No recurring series ID available")
            return False
            
        # Get one appointment from the series
        success, appointments, status = self.make_request('GET', 'appointments', None, 200)
        if not success:
            self.log_test("Preserve Recurring Fields on Series Update", False, f"Could not get appointments: {status}")
            return False
            
        series_appointments = [apt for apt in appointments if apt.get('recurring_id') == self.recurring_id]
        if not series_appointments:
            self.log_test("Preserve Recurring Fields on Series Update", False, "No appointments found in recurring series")
            return False
            
        test_appointment = series_appointments[0]
        original_recurring_value = test_appointment.get('recurring_value')
        original_recurring_unit = test_appointment.get('recurring_unit')
        
        # Update series with update_series=true, changing only notes (NOT frequency)
        update_data = {
            "notes": "Updated series notes - recurring fields should persist",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{test_appointment["id"]}', update_data, 200)
        if success:
            # Verify the updated appointment still has recurring metadata
            if (response.get('is_recurring') == True and 
                response.get('recurring_id') == self.recurring_id and
                response.get('recurring_value') == original_recurring_value and
                response.get('recurring_unit') == original_recurring_unit and
                response.get('notes') == "Updated series notes - recurring fields should persist"):
                
                # Verify ALL appointments in series were updated and still have recurring metadata
                updated_success, updated_appointments, _ = self.make_request('GET', 'appointments', None, 200)
                if updated_success:
                    updated_series = [apt for apt in updated_appointments if apt.get('recurring_id') == self.recurring_id]
                    
                    # Check that all future appointments in series have updated notes and preserved recurring fields
                    future_appointments = [apt for apt in updated_series if apt.get('date_time') >= datetime.now().isoformat()]
                    
                    all_preserved = True
                    updated_count = 0
                    for apt in future_appointments:
                        if (apt.get('is_recurring') == True and 
                            apt.get('recurring_id') == self.recurring_id and
                            apt.get('recurring_value') == original_recurring_value and
                            apt.get('recurring_unit') == original_recurring_unit):
                            if apt.get('notes') == "Updated series notes - recurring fields should persist":
                                updated_count += 1
                        else:
                            all_preserved = False
                            break
                    
                    if all_preserved and updated_count > 0:
                        self.log_test("Preserve Recurring Fields on Series Update", True, f"Successfully updated {updated_count} appointments in series while preserving recurring metadata")
                        return True
                    else:
                        self.log_test("Preserve Recurring Fields on Series Update", False, f"Recurring fields not preserved in all appointments. Updated: {updated_count}, All preserved: {all_preserved}")
                        return False
                else:
                    self.log_test("Preserve Recurring Fields on Series Update", False, "Could not verify updated series")
                    return False
            else:
                self.log_test("Preserve Recurring Fields on Series Update", False, f"Recurring fields not preserved in updated appointment: is_recurring={response.get('is_recurring')}, recurring_id={response.get('recurring_id')}")
                return False
        else:
            self.log_test("Preserve Recurring Fields on Series Update", False, f"Status: {status}, Response: {response}")
            return False

    def test_series_update_with_frequency_change(self):
        """Test series update with frequency change (should delete old and create new)"""
        if not self.test_client_id or not self.test_service_id:
            self.log_test("Series Update with Frequency Change", False, "Missing client or service ID")
            return False
            
        # Create a new recurring appointment for this test
        start_date = datetime.now() + timedelta(days=14)  # Start in 2 weeks
        appointment_time = start_date.replace(hour=16, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Weekly recurring for frequency change test",
            "is_recurring": True,
            "recurring_value": 1,
            "recurring_unit": "week",
            "pets": [
                {
                    "pet_name": "Bella",
                    "services": [self.test_service_id],
                    "items": []
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if not success:
            self.log_test("Series Update with Frequency Change", False, f"Could not create test appointment: {status}")
            return False
            
        test_recurring_id = response.get('recurring_id')
        test_appointment_id = response.get('id')
        
        # Get count of original series
        original_success, original_appointments, _ = self.make_request('GET', 'appointments', None, 200)
        if original_success:
            original_series = [apt for apt in original_appointments if apt.get('recurring_id') == test_recurring_id]
            original_count = len(original_series)
        else:
            self.log_test("Series Update with Frequency Change", False, "Could not get original series count")
            return False
        
        # Update frequency from weekly to bi-weekly
        update_data = {
            "is_recurring": True,
            "recurring_value": 2,
            "recurring_unit": "week",
            "notes": "Changed to bi-weekly",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{test_appointment_id}', update_data, 200)
        if success:
            # Verify the appointment has new frequency
            if (response.get('recurring_value') == 2 and 
                response.get('recurring_unit') == 'week' and
                response.get('notes') == "Changed to bi-weekly"):
                
                # Verify new series was created with correct intervals
                new_success, new_appointments, _ = self.make_request('GET', 'appointments', None, 200)
                if new_success:
                    new_series = [apt for apt in new_appointments if apt.get('recurring_id') == test_recurring_id]
                    
                    # Should have fewer appointments due to bi-weekly frequency
                    if len(new_series) < original_count:
                        # Verify 2-week intervals
                        sorted_appointments = sorted(new_series, key=lambda x: x['date_time'])
                        if len(sorted_appointments) >= 2:
                            first_date = datetime.fromisoformat(sorted_appointments[0]['date_time'].replace('Z', '+00:00'))
                            second_date = datetime.fromisoformat(sorted_appointments[1]['date_time'].replace('Z', '+00:00'))
                            interval_days = (second_date - first_date).days
                            
                            if interval_days == 14:  # 2 weeks = 14 days
                                self.log_test("Series Update with Frequency Change", True, f"Successfully changed frequency: {original_count} -> {len(new_series)} appointments, 14-day intervals")
                                return True
                            else:
                                self.log_test("Series Update with Frequency Change", False, f"Incorrect interval: {interval_days} days instead of 14")
                                return False
                        else:
                            self.log_test("Series Update with Frequency Change", False, "Not enough appointments to verify interval")
                            return False
                    else:
                        self.log_test("Series Update with Frequency Change", False, f"Series count did not decrease: {original_count} -> {len(new_series)}")
                        return False
                else:
                    self.log_test("Series Update with Frequency Change", False, "Could not get updated series")
                    return False
            else:
                self.log_test("Series Update with Frequency Change", False, "Frequency not updated correctly")
                return False
        else:
            self.log_test("Series Update with Frequency Change", False, f"Status: {status}, Response: {response}")
            return False

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
        self.test_invoices_filter_by_status()

        # Test Critical Recurring Appointment Features
        print("\n🔄 Testing Critical Recurring Appointment Features...")
        self.test_recurring_appointments_create()
        self.test_edit_single_occurrence_detach()
        self.test_preserve_recurring_fields_on_series_update()
        self.test_series_update_with_frequency_change()

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