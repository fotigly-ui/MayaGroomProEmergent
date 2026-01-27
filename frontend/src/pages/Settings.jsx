import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Building2, CreditCard, MessageSquare, Clock, Edit2, Eye, Database, CheckCircle, Lock } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DEFAULT_TEMPLATES = {
  appointment_booked: {
    name: "Appointment Booked",
    template: "Hi {client_name}! Your appointment for {pet_names} at {business_name} is confirmed for {date} at {time}. See you then! Reply CONFIRM to confirm.",
    enabled: true
  },
  appointment_changed: {
    name: "Appointment Changed",
    template: "Hi {client_name}, your appointment for {pet_names} at {business_name} has been updated. New details: {date} at {time}. Reply CONFIRM to confirm.",
    enabled: true
  },
  appointment_rescheduled: {
    name: "Appointment Rescheduled",
    template: "Hi {client_name}, your appointment has been rescheduled to {date} at {time}. If this doesn't work, please call us at {business_phone}.",
    enabled: true
  },
  appointment_cancelled: {
    name: "Appointment Cancelled",
    template: "Hi {client_name}, your appointment for {pet_names} on {date} at {business_name} has been cancelled. Contact us to rebook: {business_phone}",
    enabled: true
  },
  no_show: {
    name: "No Show",
    template: "Hi {client_name}, we missed you today at {business_name}! Please contact us at {business_phone} to reschedule your appointment for {pet_names}.",
    enabled: true
  },
  confirmation_request: {
    name: "Confirmation Request",
    template: "Hi {client_name}! Reminder: You have an appointment for {pet_names} at {business_name} on {date} at {time}. Reply CONFIRM to confirm or call {business_phone} to reschedule.",
    enabled: true
  }
};

export default function Settings() {
  const { settings, updateSettings } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: settings?.business_name || '',
    abn: settings?.abn || '',
    phone: settings?.phone || '',
    email: settings?.email || '',
    address: settings?.address || '',
    pay_id: settings?.pay_id || '',
    bank_name: settings?.bank_name || '',
    bsb: settings?.bsb || '',
    account_number: settings?.account_number || '',
    account_name: settings?.account_name || '',
    gst_enabled: settings?.gst_enabled || false,
    gst_rate: settings?.gst_rate || 10,
    use_24_hour_clock: settings?.use_24_hour_clock ?? true,
    // SMS Settings
    sms_enabled: settings?.sms_enabled || false,
    sms_mode: settings?.sms_mode || 'manual',
    sms_provider: settings?.sms_provider || '',
    twilio_account_sid: settings?.twilio_account_sid || '',
    twilio_auth_token: settings?.twilio_auth_token || '',
    twilio_phone_number: settings?.twilio_phone_number || '',
    send_confirmation_request: settings?.send_confirmation_request ?? true,
    confirmation_request_value: settings?.confirmation_request_value || 2,
    confirmation_request_unit: settings?.confirmation_request_unit || 'days',
    send_24h_reminder: settings?.send_24h_reminder ?? true,
    reminder_value: settings?.reminder_value || 24,
    reminder_unit: settings?.reminder_unit || 'hours'
  });
  
  const [smsTemplates, setSmsTemplates] = useState(() => {
    try {
      return settings?.sms_templates && Object.keys(settings.sms_templates).length > 0 
        ? settings.sms_templates 
        : DEFAULT_TEMPLATES;
    } catch (e) {
      return DEFAULT_TEMPLATES;
    }
  });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ template: '', enabled: true });
  const [previewData, setPreviewData] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        business_name: settings.business_name || '',
        abn: settings.abn || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        pay_id: settings.pay_id || '',
        bank_name: settings.bank_name || '',
        bsb: settings.bsb || '',
        account_number: settings.account_number || '',
        account_name: settings.account_name || '',
        gst_enabled: settings.gst_enabled || false,
        gst_rate: settings.gst_rate || 10,
        use_24_hour_clock: settings.use_24_hour_clock ?? true,
        sms_enabled: settings.sms_enabled || false,
        sms_mode: settings.sms_mode || 'manual',
        sms_provider: settings.sms_provider || '',
        twilio_account_sid: settings.twilio_account_sid || '',
        twilio_auth_token: settings.twilio_auth_token || '',
        twilio_phone_number: settings.twilio_phone_number || '',
        send_confirmation_request: settings.send_confirmation_request ?? true,
        confirmation_request_value: settings.confirmation_request_value || 2,
        confirmation_request_unit: settings.confirmation_request_unit || 'days',
        send_24h_reminder: settings.send_24h_reminder ?? true,
        reminder_value: settings.reminder_value || 24,
        reminder_unit: settings.reminder_unit || 'hours'
      });
      try {
        setSmsTemplates(settings.sms_templates && Object.keys(settings.sms_templates).length > 0 
          ? settings.sms_templates 
          : DEFAULT_TEMPLATES);
      } catch (e) {
        setSmsTemplates(DEFAULT_TEMPLATES);
      }
    }
  }, [settings]);

  useEffect(() => {
    fetchBackupStatus();
  }, []);

  const fetchBackupStatus = async () => {
    try {
      const token = localStorage.getItem('maya_token');
      const res = await axios.get(`${API_URL}/backup/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBackupStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch backup status');
    }
  };

  const triggerBackup = async () => {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem('maya_token');
      await axios.post(`${API_URL}/backup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Backup started! Your data is being saved to Supabase.');
      // Refresh status after a delay
      setTimeout(fetchBackupStatus, 3000);
    } catch (error) {
      if (error.response?.status === 503) {
        toast.error('Backup service not configured');
      } else {
        toast.error('Failed to start backup');
      }
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings({ ...formData, sms_templates: smsTemplates });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openTemplateEditor = (key) => {
    setEditingTemplate(key);
    setTemplateForm({
      template: smsTemplates[key]?.template || '',
      enabled: smsTemplates[key]?.enabled ?? true
    });
  };

  const saveTemplate = () => {
    setSmsTemplates(prev => ({
      ...prev,
      [editingTemplate]: {
        ...prev[editingTemplate],
        template: templateForm.template,
        enabled: templateForm.enabled
      }
    }));
    setEditingTemplate(null);
    toast.success('Template updated - remember to save settings');
  };

  const previewTemplate = async (key) => {
    try {
      const token = localStorage.getItem('maya_token');
      const res = await axios.post(`${API_URL}/sms/preview?message_type=${key}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreviewData({ key, ...res.data });
    } catch (error) {
      toast.error('Failed to generate preview');
    }
  };

  const templateVariables = [
    { var: '{client_name}', desc: 'Client\'s name' },
    { var: '{pet_names}', desc: 'Pet name(s)' },
    { var: '{business_name}', desc: 'Your business name' },
    { var: '{business_phone}', desc: 'Your phone number' },
    { var: '{date}', desc: 'Appointment date' },
    { var: '{time}', desc: 'Appointment time' }
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl">
        <PageHeader 
          title="Settings" 
          subtitle="Manage your business preferences"
        />

        <Tabs defaultValue="business" className="w-full">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Building2 size={16} />
              <span className="hidden sm:inline">Business</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard size={16} />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Clock size={16} />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <Database size={16} />
              <span className="hidden sm:inline">Backup</span>
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSave}>
            <TabsContent value="business">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Business Information</h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input
                      value={formData.business_name}
                      onChange={(e) => updateField('business_name', e.target.value)}
                      placeholder="Your Business Name"
                      data-testid="settings-business-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ABN</Label>
                    <Input
                      value={formData.abn}
                      onChange={(e) => updateField('abn', e.target.value)}
                      placeholder="XX XXX XXX XXX"
                      data-testid="settings-abn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+61 X XXXX XXXX"
                      data-testid="settings-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contact@business.com"
                      data-testid="settings-email"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Business address"
                      data-testid="settings-address"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Payment Details</h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>PayID</Label>
                    <Input
                      value={formData.pay_id}
                      onChange={(e) => updateField('pay_id', e.target.value)}
                      placeholder="your@payid.com.au"
                      data-testid="settings-payid"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => updateField('bank_name', e.target.value)}
                      placeholder="Bank name"
                      data-testid="settings-bank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BSB</Label>
                    <Input
                      value={formData.bsb}
                      onChange={(e) => updateField('bsb', e.target.value)}
                      placeholder="XXX-XXX"
                      data-testid="settings-bsb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => updateField('account_number', e.target.value)}
                      placeholder="XXXXXXXX"
                      data-testid="settings-account-number"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Account Name</Label>
                    <Input
                      value={formData.account_name}
                      onChange={(e) => updateField('account_name', e.target.value)}
                      placeholder="Account holder name"
                      data-testid="settings-account-name"
                    />
                  </div>
                </div>

                <div className="border-t border-maya-border pt-6">
                  <h3 className="text-md font-medium text-maya-text mb-4">GST Settings</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable GST</Label>
                      <p className="text-sm text-maya-text-muted">Include GST in invoices</p>
                    </div>
                    <Switch
                      checked={formData.gst_enabled}
                      onCheckedChange={(v) => updateField('gst_enabled', v)}
                      data-testid="settings-gst-toggle"
                    />
                  </div>
                  {formData.gst_enabled && (
                    <div className="mt-4 space-y-2">
                      <Label>GST Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.gst_rate}
                        onChange={(e) => updateField('gst_rate', parseFloat(e.target.value) || 10)}
                        data-testid="settings-gst-rate"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sms">
              <div className="space-y-6">
                {/* SMS Enable/Mode */}
                <div className="card-maya space-y-6">
                  <h2 className="text-lg font-semibold text-maya-text">SMS Notifications</h2>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable SMS</Label>
                      <p className="text-sm text-maya-text-muted">Send appointment notifications via SMS</p>
                    </div>
                    <Switch
                      checked={formData.sms_enabled}
                      onCheckedChange={(v) => updateField('sms_enabled', v)}
                      data-testid="settings-sms-toggle"
                    />
                  </div>

                  {formData.sms_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>SMS Mode</Label>
                        <Select value={formData.sms_mode} onValueChange={(v) => updateField('sms_mode', v)}>
                          <SelectTrigger data-testid="settings-sms-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">
                              <div>
                                <div className="font-medium">Manual</div>
                                <div className="text-xs text-maya-text-muted">Copy messages to send from your phone</div>
                              </div>
                            </SelectItem>
                            <SelectItem value="automated">
                              <div>
                                <div className="font-medium">Automated</div>
                                <div className="text-xs text-maya-text-muted">Auto-send via Twilio</div>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.sms_mode === 'automated' && (
                        <div className="space-y-4 p-4 bg-maya-cream rounded-lg">
                          <h3 className="font-medium text-maya-text">Twilio Configuration</h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Account SID</Label>
                              <Input
                                value={formData.twilio_account_sid}
                                onChange={(e) => updateField('twilio_account_sid', e.target.value)}
                                placeholder="ACxxxxxxxx"
                                data-testid="settings-twilio-sid"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Auth Token</Label>
                              <Input
                                type="password"
                                value={formData.twilio_auth_token}
                                onChange={(e) => updateField('twilio_auth_token', e.target.value)}
                                placeholder="••••••••"
                                data-testid="settings-twilio-token"
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Twilio Phone Number</Label>
                              <Input
                                value={formData.twilio_phone_number}
                                onChange={(e) => updateField('twilio_phone_number', e.target.value)}
                                placeholder="+61400000000"
                                data-testid="settings-twilio-phone"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-maya-text-muted">
                            Get your Twilio credentials from <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.twilio.com</a>
                          </p>
                        </div>
                      )}

                      <div className="border-t border-maya-border pt-6">
                        <h3 className="font-medium text-maya-text mb-4">Auto-Send Options</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Confirmation Requests</Label>
                              <p className="text-sm text-maya-text-muted">Send confirmation request before appointment</p>
                            </div>
                            <Switch
                              checked={formData.send_confirmation_request}
                              onCheckedChange={(v) => updateField('send_confirmation_request', v)}
                            />
                          </div>
                          {formData.send_confirmation_request && (
                            <div className="ml-4 flex items-center gap-2">
                              <Label className="whitespace-nowrap">Send</Label>
                              <Input
                                type="number"
                                min="1"
                                max="365"
                                value={formData.confirmation_request_value}
                                onChange={(e) => updateField('confirmation_request_value', parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                              <Select 
                                value={formData.confirmation_request_unit} 
                                onValueChange={(v) => updateField('confirmation_request_unit', v)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="weeks">Weeks</SelectItem>
                                  <SelectItem value="months">Months</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-sm text-maya-text-muted">before</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Appointment Reminder</Label>
                              <p className="text-sm text-maya-text-muted">Send reminder before appointment</p>
                            </div>
                            <Switch
                              checked={formData.send_24h_reminder}
                              onCheckedChange={(v) => updateField('send_24h_reminder', v)}
                            />
                          </div>
                          {formData.send_24h_reminder && (
                            <div className="ml-4 flex items-center gap-2">
                              <Label className="whitespace-nowrap">Send</Label>
                              <Input
                                type="number"
                                min="1"
                                max="365"
                                value={formData.reminder_value}
                                onChange={(e) => updateField('reminder_value', parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                              <Select 
                                value={formData.reminder_unit} 
                                onValueChange={(v) => updateField('reminder_unit', v)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="weeks">Weeks</SelectItem>
                                  <SelectItem value="months">Months</SelectItem>
                                </SelectContent>
                              </Select>
                              <span className="text-sm text-maya-text-muted">before</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* SMS Templates - Always visible so users can customize */}
                <div className="card-maya space-y-4">
                  <h2 className="text-lg font-semibold text-maya-text">Message Templates</h2>
                  <p className="text-sm text-maya-text-muted">
                    Customize your SMS messages. Use variables: {'{client_name}'}, {'{pet_names}'}, {'{date}'}, {'{time}'}, {'{business_name}'}
                  </p>
                  
                  {!formData.sms_enabled && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-3 text-sm">
                      Enable SMS above to send these messages automatically
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {smsTemplates && Object.entries(smsTemplates).map(([key, template]) => template && (
                      <div 
                        key={key} 
                        className="flex items-center justify-between p-3 bg-maya-cream dark:bg-gray-800 rounded-lg"
                        data-testid={`template-${key}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-maya-text text-sm">{template.name || key}</h4>
                            {!template.enabled && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Off</span>
                            )}
                          </div>
                          <p className="text-xs text-maya-text-muted mt-1 truncate">{template.template || 'No template set'}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openTemplateEditor(key)}
                          className="ml-2"
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Display Preferences</h2>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>24-Hour Clock</Label>
                    <p className="text-sm text-maya-text-muted">Display times in 24-hour format</p>
                  </div>
                  <Switch
                    checked={formData.use_24_hour_clock}
                    onCheckedChange={(v) => updateField('use_24_hour_clock', v)}
                    data-testid="settings-24hr-toggle"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="backup">
              <div className="card-maya space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-maya-text">Data Backup</h2>
                  <Button
                    type="button"
                    onClick={triggerBackup}
                    disabled={backupLoading}
                    className="btn-maya-primary h-8 px-3 text-sm"
                    data-testid="backup-now-btn"
                  >
                    {backupLoading ? (
                      <Loader2 className="animate-spin mr-1" size={14} />
                    ) : (
                      <Database size={14} className="mr-1" />
                    )}
                    Backup
                  </Button>
                </div>
                <p className="text-sm text-maya-text-muted">
                  Your data is automatically backed up to Supabase when you create or modify records.
                </p>
                
                {/* Backup Status */}
                <div className="bg-maya-cream rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {backupStatus?.status === 'active' ? (
                      <CheckCircle className="text-maya-success" size={20} />
                    ) : (
                      <Database className="text-maya-text-muted" size={20} />
                    )}
                    <div>
                      <p className="font-medium text-maya-text text-sm">
                        {backupStatus?.status === 'active' ? 'Backup Active' : 
                         backupStatus?.status === 'not_configured' ? 'Not Configured' : 
                         'No Backups Yet'}
                      </p>
                      {backupStatus?.last_backup && (
                        <p className="text-xs text-maya-text-muted">
                          Last: {new Date(backupStatus.last_backup).toLocaleString('en-AU')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* What's backed up */}
                <div>
                  <h3 className="font-medium text-maya-text mb-3">What's backed up:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['Clients', 'Pets', 'Services', 'Items', 'Appointments', 'Waitlist', 'Settings', 'Invoices'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-maya-text-muted">
                        <CheckCircle size={14} className="text-maya-success" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-maya-text-muted">
                  Backups are stored securely in Supabase and can be restored if needed.
                </p>
              </div>
            </TabsContent>

            <div className="mt-6 flex justify-end">
              <Button 
                type="submit" 
                className="btn-maya-primary"
                disabled={loading}
                data-testid="save-settings-btn"
              >
                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                Save Settings
              </Button>
            </div>
          </form>
        </Tabs>
      </div>

      {/* Template Editor Modal */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template: {smsTemplates[editingTemplate]?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={templateForm.enabled}
                onCheckedChange={(v) => setTemplateForm(prev => ({ ...prev, enabled: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Message Template</Label>
              <Textarea
                value={templateForm.template}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, template: e.target.value }))}
                rows={5}
                placeholder="Enter your message template..."
                data-testid="template-editor-textarea"
              />
              <p className="text-xs text-maya-text-muted">
                {templateForm.template.length} characters
              </p>
            </div>
            <div className="p-3 bg-maya-cream rounded-lg">
              <p className="text-xs font-medium text-maya-text mb-2">Available Variables:</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {templateVariables.map(v => (
                  <div key={v.var} className="flex justify-between">
                    <code className="text-primary">{v.var}</code>
                    <span className="text-maya-text-muted">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={saveTemplate} className="btn-maya-primary">Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Preview: {smsTemplates[previewData?.key]?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-maya-cream rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{previewData?.preview}</p>
            </div>
            <div className="text-xs text-maya-text-muted">
              <p>{previewData?.char_count} characters</p>
              <p className="mt-1">Note: This is a sample preview with placeholder data.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewData(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
