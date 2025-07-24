import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BankDetail {
  id: string;
  account_number: string;
  bank_name: string;
  account_holder_name: string;
  ifsc_code: string;
  address: string;
  is_verified: boolean;
}

interface BankDetailsFormProps {
  userId: string;
  onBankDetailsAdded: () => void;
}

export function BankDetailsForm({ userId, onBankDetailsAdded }: BankDetailsFormProps) {
  const [formData, setFormData] = useState({
    account_number: '',
    bank_name: '',
    account_holder_name: '',
    ifsc_code: '',
    address: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBankDetails();
  }, [userId]);

  const fetchBankDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBankDetails(data || []);
    } catch (error) {
      console.error('Error fetching bank details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bank details",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.account_number || !formData.bank_name || !formData.account_holder_name || 
        !formData.ifsc_code || !formData.address) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return false;
    }

    // IFSC code validation (11 characters, first 4 letters, 5th is 0, last 6 alphanumeric)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(formData.ifsc_code)) {
      toast({
        title: "Error",
        description: "Please enter a valid IFSC code",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isEditing) {
        const { error } = await supabase
          .from('bank_details')
          .update(formData)
          .eq('id', isEditing)
          .eq('user_id', userId);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Bank details updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('bank_details')
          .insert({
            ...formData,
            user_id: userId
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Bank details added successfully",
        });
      }

      setFormData({
        account_number: '',
        bank_name: '',
        account_holder_name: '',
        ifsc_code: '',
        address: ''
      });
      setIsEditing(null);
      fetchBankDetails();
      onBankDetailsAdded();
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast({
        title: "Error",
        description: "Failed to save bank details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (detail: BankDetail) => {
    setFormData({
      account_number: detail.account_number,
      bank_name: detail.bank_name,
      account_holder_name: detail.account_holder_name,
      ifsc_code: detail.ifsc_code,
      address: detail.address
    });
    setIsEditing(detail.id);
  };

  const cancelEdit = () => {
    setFormData({
      account_number: '',
      bank_name: '',
      account_holder_name: '',
      ifsc_code: '',
      address: ''
    });
    setIsEditing(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Bank Details' : 'Add Bank Details'}</CardTitle>
          <CardDescription>
            Add your bank account details for withdrawals. All information will be securely stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                <Input
                  id="account_holder_name"
                  name="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={handleInputChange}
                  placeholder="Full name as per bank account"
                  required
                />
              </div>
              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleInputChange}
                  placeholder="Bank account number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="Name of your bank"
                  required
                />
              </div>
              <div>
                <Label htmlFor="ifsc_code">IFSC Code</Label>
                <Input
                  id="ifsc_code"
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={handleInputChange}
                  placeholder="IFSC code of your bank branch"
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Your complete address"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Details' : 'Add Bank Details'}
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {bankDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Bank Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bankDetails.map((detail) => (
                <div key={detail.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <p><strong>Account Holder:</strong> {detail.account_holder_name}</p>
                      <p><strong>Bank:</strong> {detail.bank_name}</p>
                      <p><strong>Account Number:</strong> ****{detail.account_number.slice(-4)}</p>
                      <p><strong>IFSC:</strong> {detail.ifsc_code}</p>
                      <p className={`text-sm ${detail.is_verified ? 'text-green-600' : 'text-yellow-600'}`}>
                        Status: {detail.is_verified ? 'Verified' : 'Pending Verification'}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(detail)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}