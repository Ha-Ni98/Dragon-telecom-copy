import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { User, MapPin, Phone, Mail, Calendar, ArrowRight, Store, Receipt, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useClientMe, useUpdateClientMe, useChangeClientPassword } from "@/hooks/useClientPortal";
import { useWilayas } from "@/hooks/usePlatform";
import { MoneyStatusCard } from "@/components/shared/MoneyStatusCard";
import { NotFoundState } from "@/components/shared/NotFoundState";
import {
  updateMeSchema,
  type UpdateMeFormValues,
  type UpdateMeInput,
} from "@/pages/my-account/update-me.schema";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/pages/my-account/change-password.schema";
import { FieldError } from "@/components/shared/FieldError";
import { SectionTitle } from "@/components/shared/SectionTitle";

export default function MyAccount() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: clientMe, isLoading, isError, refetch } = useClientMe();
  const updateMutation = useUpdateClientMe();
  const changePasswordMutation = useChangeClientPassword();
  const { data: wilayasData } = useWilayas();
  const wilayas = wilayasData ?? [];

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    control: profileControl,
    watch: watchProfile,
    setValue: setProfileValue,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<UpdateMeInput, unknown, UpdateMeFormValues>({
    resolver: zodResolver(updateMeSchema(t)),
    // RHF re-syncs the form's defaults whenever this object changes by reference — no manual
    // useEffect needed to seed the form once clientMe arrives (or to pick up the fresh data
    // useUpdateClientMe's own invalidation refetches after a save).
    values: clientMe
      ? {
          email: clientMe.email ?? "",
          storeName: clientMe.storeName ?? "",
          wilayaId: clientMe.wilayaId,
          communeId: clientMe.communeId,
          address: clientMe.address ?? "",
        }
      : undefined,
  });

  const watchedWilayaId = watchProfile("wilayaId");
  const selectedWilaya = wilayas.find((w) => w.id === watchedWilayaId);
  const communeOptions = selectedWilaya?.communes ?? [];

  const {
    register: registerPassword,
    handleSubmit: handlePasswordFormSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema(t)),
  });

  const handleCancel = () => {
    resetProfile();
    setIsEditing(false);
  };

  const onProfileSubmit = (data: UpdateMeFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        toast.success(t('account.updateSuccess'));
        setIsEditing(false);
      },
      onError: () => {
        toast.error(t('account.updateError'));
      },
    });
  };

  const onChangePassword = (data: ChangePasswordFormValues) => {
    // ChangeMyPasswordCommand never carries confirmPassword (client-side only, per the schema's
    // own AssertAssignable check).
    const { confirmPassword: _confirmPassword, ...command } = data;
    changePasswordMutation.mutate(command, {
      onSuccess: () => {
        toast.success(t('account.changePasswordSuccess'));
        resetPasswordForm();
        setIsChangingPassword(false);
      },
      onError: () => {
        toast.error(t('account.changePasswordError'));
      },
    });
  };

  const handleViewOrders = () => {
    navigate('/orders');
  };

  const handleViewInvoices = () => {
    // My Invoices' destination page isn't part of this page set (scope confinement, same as
    // the /staff landing in Sprint 2) — the shortcut is planned, its target isn't.
    navigate('/invoices');
  };

  if (isLoading) {
    return (
      <div>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="mb-8 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full max-w-72" />
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

  if (isError || !clientMe) {
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
            <SectionTitle as="h1" className="text-3xl font-bold">{t('account.title')}</SectionTitle>
            <p className="text-muted-foreground">{t('account.description')}</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            {/* "Credits & Balance" doesn't fit a 50%-width tab at mobile widths (TabsTrigger is
                whitespace-nowrap) — stack the two tabs below sm, side-by-side from sm+ up. */}
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
              <TabsTrigger value="profile">{t('account.profile')}</TabsTrigger>
              <TabsTrigger value="billing">{t('account.billing')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {t('account.personalInfo')}
                        </CardTitle>
                        <CardDescription>{t('account.personalInfoDesc')}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button type="button" variant="outline" onClick={handleCancel}>
                              {t('register.cancel')}
                            </Button>
                            <Button type="submit" variant="default" disabled={updateMutation.isPending}>
                              {t('account.save')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                              {t('account.edit')}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setIsChangingPassword(true)}>
                              {t('account.changePassword')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t('register.firstName')}</Label>
                        <Input
                          id="firstName"
                          value={clientMe.firstName}
                          disabled
                          className="bg-muted cursor-not-allowed"
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t('register.lastName')}</Label>
                        <Input
                          id="lastName"
                          value={clientMe.lastName}
                          disabled
                          className="bg-muted cursor-not-allowed"
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {/* Phone is read-only (PUB-08) — UpdateMeCommand.strict() 400s on a phone
                          key, so it's excluded from update-me.schema.ts entirely. */}
                      <Label htmlFor="phone">{t('register.phone')}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={clientMe.phone}
                          disabled
                          readOnly
                          className="pl-10 bg-muted cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('register.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          {...registerProfile('email')}
                          disabled={!isEditing}
                          className="pl-10"
                        />
                      </div>
                      {profileErrors.email && (
                        <FieldError>{profileErrors.email.message}</FieldError>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storeName">{t('register.storeName')}</Label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="storeName"
                          {...registerProfile('storeName')}
                          disabled={!isEditing}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="wilayaId">{t('register.wilaya')}</Label>
                        <Controller
                          control={profileControl}
                          name="wilayaId"
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                setProfileValue("communeId", "");
                              }}
                              disabled={!isEditing}
                            >
                              <SelectTrigger id="wilayaId">
                                <SelectValue placeholder={t('register.selectWilaya')} />
                              </SelectTrigger>
                              <SelectContent>
                                {wilayas.map((wilaya) => (
                                  <SelectItem key={wilaya.id} value={wilaya.id}>
                                    {wilaya.frName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {profileErrors.wilayaId && (
                          <FieldError>{profileErrors.wilayaId.message}</FieldError>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="communeId">{t('register.commune')}</Label>
                        <Controller
                          control={profileControl}
                          name="communeId"
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isEditing || !watchedWilayaId}
                            >
                              <SelectTrigger id="communeId">
                                <SelectValue placeholder={t('register.selectCommune')} />
                              </SelectTrigger>
                              <SelectContent>
                                {communeOptions.map((commune) => (
                                  <SelectItem key={commune.id} value={commune.id}>
                                    {commune.frName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {profileErrors.communeId && (
                          <FieldError>{profileErrors.communeId.message}</FieldError>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">{t('account.address')}</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          {...registerProfile('address')}
                          disabled={!isEditing}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </form>

              {/* Change Password */}
              {isChangingPassword && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5" />
                      {t('account.changePassword')}
                    </CardTitle>
                  </CardHeader>
                  <form onSubmit={handlePasswordFormSubmit(onChangePassword)}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">{t('account.currentPassword')}</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          {...registerPassword('currentPassword')}
                          placeholder={t('account.currentPasswordPlaceholder')}
                        />
                        {passwordErrors.currentPassword && (
                          <FieldError>{passwordErrors.currentPassword.message}</FieldError>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{t('account.newPassword')}</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          {...registerPassword('newPassword')}
                          placeholder={t('account.newPasswordPlaceholder')}
                        />
                        {passwordErrors.newPassword && (
                          <FieldError>{passwordErrors.newPassword.message}</FieldError>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('account.confirmPassword')}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          {...registerPassword('confirmPassword')}
                          placeholder={t('account.confirmPasswordPlaceholder')}
                        />
                        {passwordErrors.confirmPassword && (
                          <FieldError>{passwordErrors.confirmPassword.message}</FieldError>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            resetPasswordForm();
                            setIsChangingPassword(false);
                          }}
                        >
                          {t('register.cancel')}
                        </Button>
                        <Button type="submit" disabled={changePasswordMutation.isPending}>
                          {t('account.save')}
                        </Button>
                      </div>
                    </CardContent>
                  </form>
                </Card>
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
                        {new Date(clientMe.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <MoneyStatusCard
                credit={clientMe.credit}
                totalPaid={clientMe.totalPaid}
                totalSold={clientMe.totalSold}
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

              {/* Invoices Navigation */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('account.myInvoices')}</CardTitle>
                  <CardDescription>{t('account.myInvoicesSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                        <Receipt className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <Button
                      onClick={handleViewInvoices}
                      variant="outline"
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      {t('account.myInvoices')}
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
