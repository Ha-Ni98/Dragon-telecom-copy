/**
 * DeliveryForm Component
 * Handles delivery information form with wilaya/commune selection
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Home, Building, Truck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAvailableWilayas, useCommunesForWilaya, useDeliveryFeeCalculation } from "@/hooks/use-delivery-fees";
import type { DeliveryFormData } from "@/types/draft-types";

// Form validation schema
const deliveryFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
 // lastName: z.string().min(2, "Last name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  wilaya: z.string().min(1, "Please select a wilaya"),
  commune: z.string().min(1, "Please select a commune"),
  address: z.string().optional().nullable(),
  deliveryMode: z.enum(["home", "office"], {
    error: "Please select a delivery mode"
  })
});

interface DeliveryFormProps {
  onSubmit: (data: DeliveryFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
  prefillData?: Partial<DeliveryFormData>;
}

export function DeliveryForm({
  onSubmit,
  onCancel,
  isLoading = false,
  className,
  prefillData
}: DeliveryFormProps) {
  const { t } = useTranslation();
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [deliveryMode, setDeliveryMode] = useState<"home" | "office">("home");

  // Fetch available wilayas
  const { data: wilayas = [], isLoading: wilayasLoading } = useAvailableWilayas();
  
  // Fetch communes for selected wilaya
  const { data: communes = [], isLoading: communesLoading } = useCommunesForWilaya(selectedWilaya);
  
  // Calculate delivery fee
  const { data: deliveryFee = 0, isLoading: feeLoading } = useDeliveryFeeCalculation(
    selectedWilaya,
    selectedCommune,
    deliveryMode
  );

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid }
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: {
      fullName: prefillData?.fullName || "",
      phone: prefillData?.phone || "",
      wilaya: prefillData?.wilaya || "",
      commune: prefillData?.commune || "",
      deliveryMode: prefillData?.deliveryMode || "home"
    }
  });

  // Watch form values
  const watchedValues = watch();

  // Update form values when selections change
  useEffect(() => {
    setValue("wilaya", selectedWilaya);
    setValue("commune", selectedCommune);
    setValue("deliveryMode", deliveryMode);
  }, [selectedWilaya, selectedCommune, deliveryMode, setValue]);

  // Handle wilaya selection
  const handleWilayaChange = (wilaya: string) => {
    setSelectedWilaya(wilaya);
    setSelectedCommune(""); // Reset commune when wilaya changes
  };

  // Handle commune selection
  const handleCommuneChange = (commune: string) => {
    setSelectedCommune(commune);
  };

  // Handle delivery mode change
  const handleDeliveryModeChange = (mode: "home" | "office") => {
    setDeliveryMode(mode);
  };

  // Handle form submission
  const handleFormSubmit = (data: DeliveryFormData) => {
    onSubmit({
      ...data,
      wilaya: selectedWilaya,
      commune: selectedCommune,
      address: prefillData?.address || "",
      deliveryMode
    });
  };

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Truck className="w-5 h-5" />
          <span>{t("product.delivery")}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("product.personalInfo")}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("product.fullName")}</Label>
                <Input
                  id="fullName"
                  {...register("fullName")}
                  placeholder={t("product.fullNamePlaceholder")}
                  className={cn(errors.fullName && "border-destructive")}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">{t("product.phone")}</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder={t("product.phonePlaceholder")}
                  className={cn(errors.phone && "border-destructive")}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
              {/* <div className="space-y-2">
                <Label htmlFor="lastName">{t("product.lastName")}</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  placeholder={t("product.lastNamePlaceholder")}
                  className={cn(errors.lastName && "border-destructive")}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div> */}
            </div>
            
            
          </div>

          <Separator />

          {/* Location Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>{t("product.location")}</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("product.wilaya")}</Label>
                <Select
                  {...register("wilaya")}
                  value={selectedWilaya}
                  onValueChange={handleWilayaChange}
                  disabled={wilayasLoading}
                >
                  <SelectTrigger className={cn(errors.wilaya && "border-destructive")}>
                    <SelectValue placeholder={t("product.selectWilaya")} />
                  </SelectTrigger>
                  <SelectContent>
                    {wilayas.map((wilaya) => (
                      <SelectItem key={wilaya} value={wilaya}>
                        {wilaya}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.wilaya && (
                  <p className="text-sm text-destructive">{errors.wilaya.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>{t("product.commune")}</Label>
                <Select
                  {...register("commune")}
                  value={selectedCommune}
                  onValueChange={handleCommuneChange}
                  disabled={!selectedWilaya || communesLoading}
                >
                  <SelectTrigger className={cn(errors.commune && "border-destructive")}>
                    <SelectValue placeholder={t("product.selectCommune")} />
                  </SelectTrigger>
                  <SelectContent>
                    {communes.map((commune) => (
                      <SelectItem key={commune} value={commune}>
                        {commune}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.commune && (
                  <p className="text-sm text-destructive">{errors.commune.message}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">{t("product.address")} ({t("product.optional")})</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder={t("product.addressPlaceholder")}
                onChange={(e) => setValue("address", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Delivery Mode Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("product.deliveryMode")}</h3>
            
            <RadioGroup
              value={deliveryMode}
              onValueChange={handleDeliveryModeChange}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="home" id="home" />
                <Label htmlFor="home" className="flex items-center space-x-2 cursor-pointer">
                  <Home className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{t("product.deliveryToHome")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.deliveryToHomeDesc")}
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="office" id="office" />
                <Label htmlFor="office" className="flex items-center space-x-2 cursor-pointer">
                  <Building className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{t("product.deliveryToOffice")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("product.deliveryToOfficeDesc")}
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
            
            {errors.deliveryMode && (
              <p className="text-sm text-destructive">{errors.deliveryMode.message}</p>
            )}
          </div>

          {/* Delivery Fee Display */}
          {selectedWilaya && selectedCommune && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t("product.deliveryFee")}:</span>
                <span className="text-lg font-bold text-primary">
                  {feeLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  ) : (
                    `${deliveryFee.toLocaleString()} DA`
                  )}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {deliveryMode === "home" 
                  ? t("product.deliveryToHomeFee")
                  : t("product.deliveryToOfficeFee")
                }
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={ !selectedWilaya || !selectedCommune}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("common.processing")}
                </>
              ) : (
                t("product.confirmDelivery")
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
