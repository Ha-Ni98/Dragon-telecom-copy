import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useWilayas } from "@/hooks/usePlatform";
import { useValidatePhone, useRegisterClient } from "@/hooks/useClientPortal";
import { Link } from "react-router-dom";
import { RegistrationConfirmationDialog } from "@/components/shared/RegistrationConfirmationDialog";
import { registerSchema, type RegisterFormValues, type RegisterInput } from "@/pages/register/register.schema";
import { PhoneAvailability } from "@dragon-telecom/contract";

// D8: the static WilayaProvider (~480KB JSON, name-keyed) is gone — useWilayas() (real server
// hook, uuid ids + nested communes) replaces it, so this page no longer needs its own provider
// wrapper or lazy chunk for that data.
export default function Register() {
  const { t } = useTranslation();
  const { data: wilayasData, isLoading: wilayasLoading } = useWilayas();
  const wilayas = wilayasData ?? [];
  const validatePhoneMutation = useValidatePhone();
  const registerMutation = useRegisterClient();

  const [phoneConflict, setPhoneConflict] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState<RegisterFormValues | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema(t)),
    mode: "onSubmit",
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      storeName: "",
      wilayaId: "",
      communeId: "",
    },
  });

  const watchedWilayaId = watch("wilayaId");
  const selectedWilaya = wilayas.find((w) => w.id === watchedWilayaId);
  const communeOptions = selectedWilaya?.communes ?? [];
  const phoneField = register('phone');

  // PUB-07: "phone* (async-validated on blur via POST /api/auth/validate-phone)" — a plain
  // onBlur handler, no debounce needed (blur is already a discrete, rate-limited event, unlike
  // a keystroke stream).
  const handlePhoneBlur = async () => {
    const phone = watch("phone");
    if (!phone) return;
    setPhoneConflict(null);
    try {
      const result = await validatePhoneMutation.mutateAsync({ phone });
      if (result.status === PhoneAvailability.REGISTERED) {
        setPhoneConflict(t("register.phoneRegistered"));
      } else if (result.status === PhoneAvailability.PENDING) {
        setPhoneConflict(t("register.phonePending"));
      }
    } catch {
      // Global mutationCache toast (query-client.ts) already surfaces unexpected failures.
    }
  };

  const onSubmit = (data: RegisterFormValues) => {
    if (phoneConflict) return;
    // The confirmation dialog is the real submit gate (PUB-07) — this only stages the data.
    setPendingData(data);
    setShowConfirmation(true);
  };

  const handleConfirmRegistration = async () => {
    if (!pendingData) return;
    try {
      await registerMutation.mutateAsync(pendingData);
      setShowConfirmation(false);
      setShowSuccess(true);
      reset();
      setPendingData(null);
    } catch {
      // Keep the dialog open so the user can retry without re-filling the form; the global
      // toast already reports the failure.
    }
  };

  const pendingWilaya = wilayas.find((w) => w.id === pendingData?.wilayaId);
  const pendingCommune = pendingWilaya?.communes.find((c) => c.id === pendingData?.communeId);

  return (
    <div>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
              <CardDescription>{t('register.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {showSuccess ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        {t('register.registrationSuccess')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{t('register.firstName')}</Label>
                      <Input
                        id="firstName"
                        {...register('firstName')}
                        placeholder={t('register.firstNamePlaceholder')}
                      />
                      {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">{t('register.lastName')}</Label>
                      <Input
                        id="lastName"
                        {...register('lastName')}
                        placeholder={t('register.lastNamePlaceholder')}
                      />
                      {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('register.email')} <span className="text-muted-foreground">({t('register.optional')})</span></Label>
                    <Input
                      id="email"
                      {...register('email')}
                      type="email"
                      placeholder={t('register.emailPlaceholder')}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storeName">{t('register.storeName')} <span className="text-muted-foreground">({t('register.optional')})</span></Label>
                    <Input
                      id="storeName"
                      {...register('storeName')}
                      placeholder={t('register.storeNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('register.phone')}</Label>
                    <Input
                      id="phone"
                      {...phoneField}
                      onBlur={(e) => {
                        // Chain explicitly: RHF's own registered onBlur still runs
                        // (validation-mode triggering), then the async phone-conflict check.
                        void phoneField.onBlur(e);
                        void handlePhoneBlur();
                      }}
                      type="tel"
                      placeholder={t('register.phonePlaceholder')}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                    {!errors.phone && phoneConflict && <p className="text-sm text-destructive">{phoneConflict}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wilayaId">{t('register.wilaya')}</Label>
                      <Controller
                        control={control}
                        name="wilayaId"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              setValue("communeId", "");
                            }}
                            disabled={wilayasLoading}
                          >
                            <SelectTrigger id="wilayaId">
                              <SelectValue placeholder={t('register.selectWilaya')} />
                            </SelectTrigger>
                            <SelectContent>
                              {wilayas.map((wilaya) => (
                                <SelectItem key={wilaya.id} value={wilaya.id}>
                                  {wilaya.wilayaCode} - {wilaya.frName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.wilayaId && <p className="text-sm text-destructive">{errors.wilayaId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="communeId">{t('register.commune')}</Label>
                      <Controller
                        control={control}
                        name="communeId"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={!watchedWilayaId}>
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
                      {errors.communeId && <p className="text-sm text-destructive">{errors.communeId.message}</p>}
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={validatePhoneMutation.isPending}
                  >
                    {validatePhoneMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('register.validating')}
                      </>
                    ) : (
                      t('register.submit')
                    )}
                  </Button>
                </form>
              )}
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('register.hasAccount')}{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    {t('register.signIn')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Confirmation Dialog */}
      <RegistrationConfirmationDialog
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmRegistration}
        userData={{
          firstName: pendingData?.firstName ?? "",
          lastName: pendingData?.lastName ?? "",
          phone: pendingData?.phone ?? "",
          email: pendingData?.email,
          storeName: pendingData?.storeName,
          wilayaName: pendingWilaya?.frName ?? "",
          communeName: pendingCommune?.frName ?? "",
        }}
        isLoading={registerMutation.isPending}
      />
    </div>
  );
}
