import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useWilaya } from "@/hooks/use-wilaya";
import { useRegistration } from "@/hooks/use-registration";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RegistrationConfirmationDialog } from "@/components/shared/RegistrationConfirmationDialog";
import { useAuth } from "@/components/providers/AuthProvider";
import { WilayaProvider } from "@/components/providers/wilaya-provider";
import { Client } from "@/types/draft-types/client.types";

// WilayaProvider is mounted here rather than globally in main.tsx — it's the only consumer,
// and its static Algeria geography data (~480KB JSON) should stay in this page's own lazy
// chunk instead of bloating every route's initial bundle.
export default function Register() {
  return (
    <WilayaProvider>
      <RegisterForm />
    </WilayaProvider>
  );
}

function RegisterForm() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { wilayaOptions, getCommuneOptionsByName } = useWilaya();
  const {
    isSubmitting,
    isValidatingPhone,
    phoneError,
    showSuccess,
    validatePhone,
    registerClient,
    resetSuccess,
    clearPhoneError
  } = useRegistration();
  
  const [formData, setFormData] = useState<Partial<Client>>({
    clientFirstName: "",
    clientLastName: "",
    clientEmail: "",
    clientPhoneNumber: "",
    clientWilaya: "",
    clientCommune: ""
  });

  const [wilayaId, setWilayaId] = useState<string | null>(null);

  // Dialog state
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Redirect authenticated users to My Account
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/my-account", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const schema = z.object({
    clientFirstName: z.string().min(1, t('register.firstNameRequired')),
    clientLastName: z.string().min(1, t('register.lastNameRequired')),
    clientEmail: z.string().email(t('register.emailRequired')).optional().or(z.literal("")),
    clientPhoneNumber: z.string().min(1, t('register.phoneRequired')),
    clientWilaya: z.string().min(1, t('register.wilayaRequired')),
    clientCommune: z.string().min(1, t('register.communeRequired')),
  });
  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: formData,
  });

  // Watch form values for select components
  const watchedWilaya = watch("clientWilaya");
  const watchedCommune = watch("clientCommune");

  // Get commune options based on selected wilaya
  const communeOptions = watchedWilaya ? getCommuneOptionsByName(watchedWilaya) : [];

  const onSubmit = async (data: FormValues) => {
    clearPhoneError();

    try {
      // Validate phone number format and check for duplicates
      const phoneValidation = await validatePhone(data.clientPhoneNumber);
      
      if (!phoneValidation.isValid || phoneValidation.exists) {
        return;
      }

      // Phone validation passed, show confirmation dialog
      setFormData(data);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Phone validation error:', error);
      toast.error(t('register.phoneValidationError'));
    }
  };

  const handleConfirmRegistration = async () => {
    try {
      const result = await registerClient(formData);
      
      if (result.success) {
        // Close dialog first
        setShowConfirmation(false);
        
        // Reset form data to initial state
        const initialFormData: Partial<Client> = {
          clientFirstName: "",
          clientLastName: "",
          clientEmail: "",
          clientPhoneNumber: "",
          clientWilaya: "",
          clientCommune: ""
        };
        setFormData(initialFormData);
        
        // Reset form fields using React Hook Form's reset method
        reset(initialFormData);
        
        toast.success(t('register.registrationSuccess'));
      } else {
        toast.error(result.error || t('register.registrationFailed'));
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(t('register.registrationFailed'));
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    // Update React Hook Form value
    
    setValue(name as keyof FormValues, value);
    
    
    // Update local state
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset commune when wilaya changes
      ...(name === "clientWilaya" && { clientCommune: "" })
    }));
    
    // Reset commune in React Hook Form when wilaya changes
    if (name === "clientWilaya") {
      setValue("clientCommune", "");
    }
  };

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
              {/* Success Message */}
              {showSuccess && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
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
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientFirstName">{t('register.firstName')}</Label>
                    <Input
                      id="clientFirstName"
                      {...register('clientFirstName')}
                      placeholder={t('register.firstNamePlaceholder')}
                      required
                    />
                    {errors.clientFirstName && <p className="text-sm text-destructive">{errors.clientFirstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientLastName">{t('register.lastName')}</Label>
                    <Input
                      id="clientLastName"
                      {...register('clientLastName')}
                      placeholder={t('register.lastNamePlaceholder')}
                      required
                    />
                    {errors.clientLastName && <p className="text-sm text-destructive">{errors.clientLastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">{t('register.email')} <span className="text-muted-foreground">({t('register.optional')})</span></Label>
                  <Input
                    id="clientEmail"
                    {...register('clientEmail')}
                    type="email"
                    placeholder={t('register.emailPlaceholder')}
                  />
                  {errors.clientEmail && <p className="text-sm text-destructive">{errors.clientEmail.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhoneNumber">{t('register.phone')}</Label>
                  <Input
                    id="clientPhoneNumber"
                    {...register('clientPhoneNumber')}
                    type="tel"
                    placeholder={t('register.phonePlaceholder')}
                    required
                  />
                  {errors.clientPhoneNumber && <p className="text-sm text-destructive">{errors.clientPhoneNumber.message}</p>}
                  {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientWilaya">{t('register.wilaya')}</Label>
                    <Select value={watchedWilaya} onValueChange={(value) => handleSelectChange("clientWilaya", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.selectWilaya')} />
                      </SelectTrigger>
                      <SelectContent>
                        {wilayaOptions.map((wilaya) => (
                          <SelectItem key={wilaya.value} value={wilaya.label}>
                            {wilaya.value + " - " + wilaya.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.clientWilaya && <p className="text-sm text-destructive">{errors.clientWilaya.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientCommune">{t('register.commune')}</Label>
                    <Select value={watchedCommune} onValueChange={(value) => handleSelectChange("clientCommune", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.selectCommune')} />
                      </SelectTrigger>
                      <SelectContent>
                        {communeOptions.map((commune) => (
                          <SelectItem key={commune.value} value={commune.value}>
                            {commune.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.clientCommune && <p className="text-sm text-destructive">{errors.clientCommune.message}</p>}
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isValidatingPhone || isSubmitting}
                >
                  {isValidatingPhone ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t('register.validating')}
                    </>
                  ) : (
                    t('register.submit')
                  )}
                </Button>
              </form>
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
      
      {/* Confirmation Dialog
          Bridge (pub-pages Sprint 3): formData is still this page's own local Partial<Client>
          shape until Sprint 6 rewires this form onto register.schema.ts + useWilayas(); mapped
          inline here so the retyped dialog compiles without pulling that rewire forward. Wilaya/
          commune are names today (from the static WilayaProvider), which happens to line up with
          the dialog's *display* name props even though the real form will carry uuids later. */}
      <RegistrationConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmRegistration}
        userData={{
          firstName: formData.clientFirstName ?? "",
          lastName: formData.clientLastName ?? "",
          phone: formData.clientPhoneNumber ?? "",
          email: formData.clientEmail || undefined,
          wilayaName: formData.clientWilaya ?? "",
          communeName: formData.clientCommune ?? "",
        }}
        isLoading={isSubmitting}
      />
    </div>
  );
}