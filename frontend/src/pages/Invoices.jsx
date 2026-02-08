import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, Eye, Send, DollarSign, Clock, CheckCircle, XCircle, Printer, Edit2, Trash2 } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('maya_token')}` }
});

export default function Invoices() {
  const { settings } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSendInvoiceDialog, setShowSendInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    items: [],
    notes: '',
    due_date: ''
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, clientsRes, servicesRes, itemsRes] = await Promise.all([
        axios.get(`${API_URL}/invoices?status=${statusFilter}`, getAuthHeaders()),
        axios.get(`${API_URL}/clients`, getAuthHeaders()),
        axios.get(`${API_URL}/services`, getAuthHeaders()),
        axios.get(`${API_URL}/items`, getAuthHeaders())
      ]);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openNewInvoice = () => {
    setEditingInvoice(null);
    setFormData({
      client_id: '',
      items: [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
      notes: '',
      due_date: ''
    });
    setShowModal(true);
  };

  const openEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id,
      items: invoice.items || [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
      notes: invoice.notes || '',
      due_date: invoice.due_date ? invoice.due_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!window.confirm(`Delete invoice #${invoice.invoice_number}? This cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/invoices/${invoice.id}`, getAuthHeaders());
      toast.success('Invoice deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, unit_price: 0, total: 0 }]
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate total
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const addServiceToInvoice = (service) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        name: service.name,
        quantity: 1,
        unit_price: service.price,
        total: service.price
      }]
    }));
  };

  const addItemToInvoice = (item) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        name: item.name,
        quantity: 1,
        unit_price: item.price,
        total: item.price
      }]
    }));
  };

  // Prices include GST - calculate GST portion from total (not add on top)
  const calculateTotals = () => {
    const total = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const gstRate = settings?.gst_enabled ? (settings?.gst_rate || 10) : 0;
    // GST is included in price, so calculate the GST portion
    // If GST is 10%, then GST = total * 10/110 = total / 11
    const gstAmount = gstRate > 0 ? (total * gstRate / (100 + gstRate)) : 0;
    const subtotal = total - gstAmount;
    return { subtotal, gstAmount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    if (formData.items.length === 0 || !formData.items.some(i => i.name && i.total > 0)) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      const data = {
        client_id: formData.client_id,
        items: formData.items.filter(i => i.name && i.total > 0),
        notes: formData.notes,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null
      };
      
      if (editingInvoice) {
        await axios.put(`${API_URL}/invoices/${editingInvoice.id}`, data, getAuthHeaders());
        toast.success('Invoice updated');
      } else {
        await axios.post(`${API_URL}/invoices`, data, getAuthHeaders());
        toast.success('Invoice created');
      }
      setShowModal(false);
      setEditingInvoice(null);
      fetchData();
    } catch (error) {
      toast.error(editingInvoice ? 'Failed to update invoice' : 'Failed to create invoice');
    }
  };

  const viewInvoice = async (invoice) => {
    try {
      const res = await axios.get(`${API_URL}/invoices/by-number/${invoice.invoice_number}`, getAuthHeaders());
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice');
    }
  };

  const updateStatus = async (invoiceId, newStatus) => {
    try {
      const data = { status: newStatus };
      if (newStatus === 'paid') {
        data.paid_date = new Date().toISOString();
      }
      await axios.put(`${API_URL}/invoices/${invoiceId}`, data, getAuthHeaders());
      toast.success('Status updated');
      fetchData();
      if (selectedInvoice?.invoice?.id === invoiceId) {
        viewInvoice({ invoice_number: selectedInvoice.invoice.invoice_number });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="text-maya-success" size={16} />;
      case 'sent': return <Send className="text-maya-info" size={16} />;
      case 'overdue': return <Clock className="text-maya-error" size={16} />;
      case 'cancelled': return <XCircle className="text-gray-400" size={16} />;
      default: return <FileText className="text-maya-warning" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Invoices" 
          subtitle={`${invoices.length} invoices`}
          action={
            <Button onClick={openNewInvoice} className="btn-maya-primary" data-testid="new-invoice-btn">
              <Plus size={18} className="mr-2" />
              New Invoice
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40" data-testid="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoice List */}
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div 
              key={invoice.id} 
              className="card-maya cursor-pointer hover:border-primary transition-colors p-3"
              onClick={() => viewInvoice(invoice)}
              data-testid={`invoice-${invoice.id}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-maya-text">{invoice.invoice_number}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(invoice.status))}>
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-xs text-maya-text-muted">{invoice.client_name}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="font-bold text-sm text-primary">{formatCurrency(invoice.total)}</p>
                    <p className="text-xs text-maya-text-muted">
                      {format(new Date(invoice.created_at), 'MMM d')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}
                      className="h-7 w-7 p-0"
                      data-testid={`edit-invoice-${invoice.id}`}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice); }}
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                      data-testid={`delete-invoice-${invoice.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {invoices.length === 0 && !loading && (
            <div className="empty-state">
              <FileText className="empty-state-icon mx-auto" />
              <p className="text-lg font-medium">No invoices yet</p>
              <p className="text-sm mt-1">Create your first invoice</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Invoice Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}>
                <SelectTrigger data-testid="invoice-client-select">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Add */}
            <div className="space-y-2">
              <Label>Quick Add Services/Items</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Button
                    key={service.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addServiceToInvoice(service)}
                  >
                    {service.name} ({formatCurrency(service.price)})
                  </Button>
                ))}
                {items.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItemToInvoice(item)}
                  >
                    {item.name} ({formatCurrency(item.price)})
                  </Button>
                ))}
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
                  <Plus size={14} className="mr-1" /> Add Line
                </Button>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={item.name}
                      onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium">
                    {formatCurrency(item.total)}
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      className="text-maya-error"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-maya-cream rounded-lg p-4 space-y-2">
              {settings?.gst_enabled && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-maya-text-muted">Subtotal (excl. GST)</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-maya-text-muted">GST (incl. {settings?.gst_rate || 10}%)</span>
                    <span>{formatCurrency(gstAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-maya-border pt-2">
                <span>Total {settings?.gst_enabled ? '(incl. GST)' : ''}</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Due Date & Notes */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="btn-maya-primary" data-testid="create-invoice-btn">
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto print:max-w-full print:m-0 print:shadow-none p-3 sm:p-6">
          {selectedInvoice && (
            <>
              <DialogHeader className="print:hidden pr-8">
                <DialogTitle className="text-base sm:text-lg">Invoice</DialogTitle>
                <Button variant="outline" size="sm" onClick={printInvoice} className="absolute right-12 top-3 sm:top-4">
                  <Printer size={14} />
                </Button>
              </DialogHeader>

              {/* Invoice Content - Mobile Optimized */}
              <div className="space-y-3 sm:space-y-4 print:p-8 text-xs sm:text-sm" id="invoice-print">
                {/* Header */}
                <div className="border-b border-maya-border pb-2 sm:pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-primary">{selectedInvoice.business.name || 'Business Name'}</h2>
                  {selectedInvoice.business.abn && <p className="text-[10px] sm:text-xs text-maya-text-muted">ABN: {selectedInvoice.business.abn}</p>}
                </div>

                {/* Invoice Info */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                  <div>
                    <p className="text-[10px] sm:text-xs text-maya-text-muted mb-1">Bill To:</p>
                    <p className="font-semibold text-xs sm:text-sm">{selectedInvoice.invoice.client_name}</p>
                    {selectedInvoice.invoice.client_address && <p className="text-[10px] sm:text-xs">{selectedInvoice.invoice.client_address}</p>}
                    {selectedInvoice.invoice.client_phone && <p className="text-[10px] sm:text-xs">{selectedInvoice.invoice.client_phone}</p>}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-bold text-xs sm:text-sm">{selectedInvoice.invoice.invoice_number}</p>
                    <p className="text-[10px] sm:text-xs text-maya-text-muted">
                      {format(new Date(selectedInvoice.invoice.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Items - Simplified for Mobile */}
                <div className="border-t border-maya-border pt-2 sm:pt-3 space-y-1.5 sm:space-y-2">
                  {selectedInvoice.invoice.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start py-1.5 sm:py-2 border-b border-maya-border/30">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-xs sm:text-sm">{item.name}</p>
                        <p className="text-[10px] sm:text-xs text-maya-text-muted">Qty: {item.quantity} × {formatCurrency(item.unit_price)}</p>
                      </div>
                      <p className="font-semibold text-xs sm:text-sm whitespace-nowrap">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>

                {/* Totals - Compact */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 space-y-1">
                  {selectedInvoice.invoice.discount > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedInvoice.invoice.items.reduce((s, i) => s + i.total, 0))}</span>
                    </div>
                  )}
                  {selectedInvoice.invoice.discount > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedInvoice.invoice.discount)}</span>
                    </div>
                  )}
                  {selectedInvoice.business.gst_enabled && selectedInvoice.invoice.gst_amount > 0 && (
                    <div className="flex justify-between text-[10px] sm:text-xs text-maya-text-muted">
                      <span>GST (incl.)</span>
                      <span>{formatCurrency(selectedInvoice.invoice.gst_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base sm:text-lg font-bold border-t border-maya-border pt-1.5 sm:pt-2 mt-1.5 sm:mt-2">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(selectedInvoice.invoice.total)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedInvoice.invoice.notes && (
                  <div className="text-[10px] sm:text-xs text-maya-text-muted bg-gray-50 dark:bg-gray-800 rounded p-2">
                    <p className="font-medium">Notes:</p>
                    <p>{selectedInvoice.invoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions - Fixed at Bottom */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 pt-3 border-t border-maya-border print:hidden">
                <span className={cn("text-[10px] sm:text-xs px-2 py-1 rounded-full", getStatusColor(selectedInvoice.invoice.status))}>
                  {selectedInvoice.invoice.status}
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  {selectedInvoice.invoice.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedInvoice.invoice.id, 'sent')} className="text-xs flex-1 sm:flex-none">
                      Mark Sent
                    </Button>
                  )}
                  {['draft', 'sent', 'overdue'].includes(selectedInvoice.invoice.status) && (
                    <Button size="sm" className="btn-maya-primary text-xs flex-1 sm:flex-none" onClick={() => updateStatus(selectedInvoice.invoice.id, 'paid')}>
                      Mark Paid
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowSendInvoiceDialog(true)}
                    className="text-xs flex-1 sm:flex-none border-primary text-primary hover:bg-primary/10"
                  >
                    <Send size={14} className="mr-1" /> Send Invoice
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Invoice Dialog - SMS or Email with text summary */}
      <Dialog open={showSendInvoiceDialog} onOpenChange={setShowSendInvoiceDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            How would you like to send this invoice?
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                try {
                  if (!selectedInvoice) return;
                  const client = clients.find(c => c.id === selectedInvoice.invoice.client_id);
                  if (!client?.phone) {
                    toast.error('Client phone number not available');
                    return;
                  }
                  
                  const message = `Invoice #${selectedInvoice.invoice.invoice_number}
From: ${settings?.business_name || 'Business'}
To: ${client.name}

Date: ${format(new Date(selectedInvoice.invoice.created_at), 'MMM d, yyyy')}
Due: ${format(new Date(selectedInvoice.invoice.due_date), 'MMM d, yyyy')}

Items:
${selectedInvoice.items.map(item => `${item.name} x${item.quantity}: $${item.price.toFixed(2)}`).join('\n')}

Subtotal: $${selectedInvoice.invoice.subtotal.toFixed(2)}
${selectedInvoice.invoice.discount_amount > 0 ? `Discount: -$${selectedInvoice.invoice.discount_amount.toFixed(2)}\n` : ''}Total: $${selectedInvoice.invoice.total.toFixed(2)}

${selectedInvoice.invoice.notes ? `Notes: ${selectedInvoice.invoice.notes}\n\n` : ''}Thank you for your business!`;

                  const phone = client.phone.replace(/\D/g, '');
                  
                  // iOS Safari specific - use window.open instead
                  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                    window.open(`sms:${phone}&body=${encodeURIComponent(message)}`, '_self');
                  } else {
                    window.location.href = `sms:${phone}&body=${encodeURIComponent(message)}`;
                  }
                  
                  setShowSendInvoiceDialog(false);
                  toast.success('Opening SMS app...');
                } catch (error) {
                  console.error('SMS error:', error);
                  toast.error('Failed to open SMS');
                }
              }}
              className="w-full justify-start h-auto py-4"
              variant="outline"
            >
              <Send size={20} className="mr-3" />
              <div className="text-left">
                <div className="font-medium">Send via SMS</div>
                <div className="text-xs text-gray-500">Send invoice details as text message</div>
              </div>
            </Button>
            
            <Button
              onClick={() => {
                try {
                  if (!selectedInvoice) return;
                  const client = clients.find(c => c.id === selectedInvoice.invoice.client_id);
                  if (!client?.email) {
                    toast.error('Client email not available');
                    return;
                  }
                  
                  const subject = `Invoice #${selectedInvoice.invoice.invoice_number} from ${settings?.business_name || 'Business'}`;
                  const body = `Dear ${client.name},

Please find your invoice details below:

Invoice #${selectedInvoice.invoice.invoice_number}
Date: ${format(new Date(selectedInvoice.invoice.created_at), 'MMM d, yyyy')}
Due Date: ${format(new Date(selectedInvoice.invoice.due_date), 'MMM d, yyyy')}

Items:
${selectedInvoice.items.map(item => `${item.name} x${item.quantity}: $${item.price.toFixed(2)}`).join('\n')}

Subtotal: $${selectedInvoice.invoice.subtotal.toFixed(2)}
${selectedInvoice.invoice.discount_amount > 0 ? `Discount: -$${selectedInvoice.invoice.discount_amount.toFixed(2)}\n` : ''}Total Amount: $${selectedInvoice.invoice.total.toFixed(2)}

${selectedInvoice.invoice.notes ? `Notes: ${selectedInvoice.invoice.notes}\n\n` : ''}Thank you for your business!

Best regards,
${settings?.business_name || 'Business'}
${settings?.business_phone ? `Phone: ${settings.business_phone}` : ''}
${settings?.business_email ? `Email: ${settings.business_email}` : ''}`;

                  const mailtoLink = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                  
                  // iOS Safari specific - use window.open instead
                  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                    window.open(mailtoLink, '_self');
                  } else {
                    window.location.href = mailtoLink;
                  }
                  
                  setShowSendInvoiceDialog(false);
                  toast.success('Opening email app...');
                } catch (error) {
                  console.error('Email error:', error);
                  toast.error('Failed to open email');
                }
              }}
              className="w-full justify-start h-auto py-4"
              variant="outline"
            >
              <FileText size={20} className="mr-3" />
              <div className="text-left">
                <div className="font-medium">Send via Email</div>
                <div className="text-xs text-gray-500">Send invoice details via email</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
