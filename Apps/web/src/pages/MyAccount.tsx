import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { User, MapPin, Phone, Mail, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { UserAccountData, PasswordResetData } from "@/types/draft-types";
import { mockUserAccountData } from "@/mocks/clients";
import { MoneyStatusCard } from "@/components/shared/MoneyStatusCard";
import { PasswordResetForm } from "@/components/shared/PasswordResetForm";

export default function MyAccount() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Use proper UserAccountData structure
  const [userInfo, setUserInfo] = useState<UserAccountData>(mockUserAccountData);
  const [originalUserInfo, setOriginalUserInfo] = useState<UserAccountData>(mockUserAccountData);
  const [isEditing, setIsEditing] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isPasswordResetLoading, setIsPasswordResetLoading] = useState(false);

  const handleSave = () => {
    // Update original data to current data
    setOriginalUserInfo(userInfo);
    toast.success(t('account.updateSuccess'));
    setIsEditing(false);
  };

  const handleCancel = () => {
    // Revert to original data
    setUserInfo(originalUserInfo);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Only allow changes to editable fields
    if (name === 'clientEmail' || name === 'clientPhoneNumber' || name === 'clientLocation') {
      setUserInfo(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePasswordReset = async (data: PasswordResetData) => {
    setIsPasswordResetLoading(true);
    try {
      // Simulate API call for password reset
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real application, this would call the backend API
      console.log('Password reset data:', data);
      
      // Hide the form after successful reset
      setIsResettingPassword(false);
      
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    } finally {
      setIsPasswordResetLoading(false);
    }
  };

  const handleCancelPasswordReset = () => {
    setIsResettingPassword(false);
  };

  const handleViewOrders = () => {
    navigate('/orders');
  };

  const getStatusBadgeVariant = (status: number) => {
    switch (status) {
      case 0: // ClientStatusCode.active
        return 'default';
      case 1: // ClientStatusCode.pending
        return 'secondary';
      case 2: // ClientStatusCode.disabled
        return 'destructive';
      case 3: // ClientStatusCode.refused
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 0: return 'Active';
      case 1: return 'Pending';
      case 2: return 'Disabled';
      case 3: return 'Refused';
      default: return 'Unknown';
    }
  };

  const getCategoryName = (categoryId: number) => {
    // This would typically come from a categories lookup
    switch (categoryId) {
      case 1: return 'Retail';
      case 2: return 'Wholesale';
      default: return 'Standard';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{t('account.title')}</h1>
            <p className="text-muted-foreground">{t('account.description')}</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">{t('account.profile')}</TabsTrigger>
              <TabsTrigger value="billing">{t('account.billing')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {t('account.personalInfo')}
                      </CardTitle>
                      <CardDescription>{t('account.personalInfoDesc')}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="outline" onClick={handleCancel}>
                            {t('register.cancel')}
                          </Button>
                          <Button variant="default" onClick={handleSave}>
                            {t('account.save')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setIsEditing(true)}>
                            {t('account.edit')}
                          </Button>
                          <Button variant="secondary" onClick={() => setIsResettingPassword(true)}>
                            {t('account.resetPassword')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientFirstName">{t('register.firstName')}</Label>
                      <Input
                        id="clientFirstName"
                        name="clientFirstName"
                        value={userInfo.clientFirstName}
                        disabled={true}
                        className="bg-muted cursor-not-allowed"
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientLastName">{t('register.lastName')}</Label>
                      <Input
                        id="clientLastName"
                        name="clientLastName"
                        value={userInfo.clientLastName}
                        disabled={true}
                        className="bg-muted cursor-not-allowed"
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">{t('register.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientEmail"
                        name="clientEmail"
                        value={userInfo.clientEmail}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhoneNumber">{t('register.phone')}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientPhoneNumber"
                        name="clientPhoneNumber"
                        value={userInfo.clientPhoneNumber}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientLocation">{t('account.address')}</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clientLocation"
                        name="clientLocation"
                        value={userInfo.clientLocation || ""}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Password Reset Form */}
              {isResettingPassword && (
                <PasswordResetForm
                  onSubmit={handlePasswordReset}
                  onCancel={handleCancelPasswordReset}
                  isLoading={isPasswordResetLoading}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{t('account.accountStatus')}</CardTitle>
                  <CardDescription>{t('account.accountStatusDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col space-y-2">
                      <Label>{t('account.status')}</Label>
                      <Badge variant={getStatusBadgeVariant(userInfo.clientStatus)}>
                        {getStatusText(userInfo.clientStatus)}
                      </Badge>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label>{t('account.category')}</Label>
                      <Badge variant="outline">{getCategoryName(userInfo.idCategory)}</Badge>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label>{t('account.memberSince')}</Label>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(userInfo.clientCreatedDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <MoneyStatusCard 
                balance={userInfo.clientSolde}
                paid={userInfo.clientPaid}
                credit={userInfo.clientCredit}
              />

              {/* Orders Navigation */}
              <Card>
                <CardHeader>
                  <CardTitle>My Orders</CardTitle>
                  <CardDescription>View and manage your order history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                        <ArrowRight className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">View Your Orders</h3>
                      <p className="text-muted-foreground mb-6">
                        Access your complete order history, track shipments, and manage your purchases.
                      </p>
                    </div>
                    <Button 
                      onClick={handleViewOrders}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      {t('account.seeMyOrders')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}