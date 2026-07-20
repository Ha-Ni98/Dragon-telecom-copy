import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/useTranslation";
import { User, MapPin, Phone, Mail, Calendar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { UserAccountData, PasswordResetData } from "@/types/draft-types";
import { useMyAccount, useUpdateMyAccount, useResetMyAccountPassword } from "@/hooks/use-my-account";
import { MoneyStatusCard } from "@/components/shared/MoneyStatusCard";
import { PasswordResetForm } from "@/components/shared/PasswordResetForm";
import { NotFoundState } from "@/components/shared/NotFoundState";

export default function MyAccount() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: accountData, isLoading, isError, refetch } = useMyAccount();
  const updateMutation = useUpdateMyAccount();
  const passwordResetMutation = useResetMyAccountPassword();

  const [userInfo, setUserInfo] = useState<UserAccountData | null>(null);
  const [originalUserInfo, setOriginalUserInfo] = useState<UserAccountData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Sync local editable copy whenever the fetched account data changes.
  useEffect(() => {
    if (accountData) {
      setUserInfo(accountData);
      setOriginalUserInfo(accountData);
    }
  }, [accountData]);

  const handleSave = async () => {
    if (!userInfo) return;
    try {
      await updateMutation.mutateAsync(userInfo);
      setOriginalUserInfo(userInfo);
      toast.success(t('account.updateSuccess'));
      setIsEditing(false);
    } catch (error) {
      toast.error(t('account.updateError'));
    }
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
      setUserInfo(prev => prev ? ({
        ...prev,
        [name]: value
      }) : prev);
    }
  };

  const handlePasswordReset = async (data: PasswordResetData) => {
    try {
      await passwordResetMutation.mutateAsync(data);
      toast.success(t('account.passwordResetSuccess'));
      setIsResettingPassword(false);
    } catch (error) {
      toast.error(t('account.passwordResetError'));
      throw error;
    }
  };

  const handleCancelPasswordReset = () => {
    setIsResettingPassword(false);
  };

  const handleViewOrders = () => {
    navigate('/orders');
  };

  if (isLoading) {
    return (
      <div>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-8 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
            </div>
            {/* Personal info card */}
            <div className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            {/* Status card */}
            <div className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isError || !userInfo) {
    return (
      <div>
        <main className="container mx-auto px-4 py-8">
          <NotFoundState
            title={t('account.notFoundTitle')}
            body={t('account.notFoundBody')}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                {t('common.actions.tryAgain')}
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-8">
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
                  isLoading={passwordResetMutation.isPending}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{t('account.accountStatus')}</CardTitle>
                  <CardDescription>{t('account.accountStatusDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* PUB-08: badge "Active" only — a signed-in client is by definition approved,
                      so no other status value is ever reachable here. Category is NEVER rendered
                      (ClientMeDto has no category field by design). */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2">
                      <Label>{t('account.status')}</Label>
                      <Badge variant="default">{t('account.statusActive')}</Badge>
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
              {/* Bridge (pub-pages Sprint 3): userInfo is still the Sub-01 UserAccountData shape
                  until Sprint 6 rewires this page onto useClientMe(); mapped inline here so the
                  retyped MoneyStatusCard compiles without pulling that rewire forward. */}
              <MoneyStatusCard
                credit={userInfo.clientCredit}
                totalPaid={userInfo.clientPaid}
                totalSold={userInfo.clientSolde}
              />

              {/* Orders Navigation */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('account.myOrders')}</CardTitle>
                  <CardDescription>{t('account.myOrdersSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                        <ArrowRight className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{t('account.viewYourOrders')}</h3>
                      <p className="text-muted-foreground mb-6">
                        {t('account.viewYourOrdersBody')}
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