import { useState, useEffect } from "react";
import { ArrowLeft, Upload, X, Calculator, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTranslation } from '@/hooks/useTranslation';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { mockFamilies } from "@/mocks/families";
import { mockBrands } from "@/mocks/brands";
import { mockModels } from "@/mocks/models";
import { mockSuppliers } from "@/mocks/suppliers";
import { 
  ProductAddFormData, 
  ProductAddValidationErrors, 
  BarcodeGenerationResult 
} from "@/types/draft-types";

export default function AdminProductsAdd() {
  const navigate = useNavigate();
  
  const [images, setImages] = useState<string[]>([]);
  const [formData, setFormData] = useState<Partial<ProductAddFormData>>({
    barcode: "",
    family: "",
    brand: "",
    model: "",
    productName: "",
    description: "",
    quantity: 0,
    supplierId: undefined,
    unitPrice: 0,
    noUserPrice: undefined,
    categoryPrices: {},
    images: []
  });
  const { t } = useTranslation();
  // Form validation state
  const [errors, setErrors] = useState<ProductAddValidationErrors>({});
  
  // Dropdown states
  const [familyOpen, setFamilyOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  
  // Search states
  const [familySearch, setFamilySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");

  // Additional form fields for UI
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [categoryPrices, setCategoryPrices] = useState<Record<number, number>>({});
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Generate automatic barcode
  const generateBarcode = (): BarcodeGenerationResult => {
    try {
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const barcode = `BC${timestamp.slice(-8)}${random}`;
      setFormData(prev => ({ ...prev, barcode }));
      return { barcode, success: true };
    } catch (error) {
      return { barcode: "", success: false, error: "Failed to generate barcode" };
    }
  };

  // Auto-generate product name when family, brand, and model are selected
  useEffect(() => {
    if (formData.family && formData.brand && formData.model) {
      const autoName = `${formData.family} ${formData.brand} ${formData.model}`;
      setFormData(prev => ({ ...prev, productName: autoName }));
    }
  }, [formData.family, formData.brand, formData.model]);

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: ProductAddValidationErrors = {};
    
    if (!formData.barcode || formData.barcode.trim() === "") newErrors.barcode = t("admin.productAdd.validation.barcodeRequired");
    if (!formData.productName || formData.productName.trim() === "") newErrors.productName = t("admin.productAdd.validation.productNameRequired");
    if (!formData.family || formData.family.trim() === "") newErrors.family = t("admin.productAdd.validation.familyRequired");
    if (!formData.brand || formData.brand.trim() === "") newErrors.brand = t("admin.productAdd.validation.brandRequired");
    if (!formData.model || formData.model.trim() === "") newErrors.model = t("admin.productAdd.validation.modelRequired");
    if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = t("admin.productAdd.validation.quantityRequired");
    if (!formData.unitPrice || formData.unitPrice <= 0) newErrors.unitPrice = t("admin.productAdd.validation.unitPriceRequired");
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && images.length < 3) {
      const newImages = Array.from(files).slice(0, 3 - images.length).map(file => URL.createObjectURL(file));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (field: keyof ProductAddFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing and field has a value
    if (errors[field as keyof ProductAddValidationErrors] && value) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const calculateRevenue = (purchasePrice: number, sellingPrice: number): string => {
    if (purchasePrice === 0) return "0%";
    const revenue = ((sellingPrice - purchasePrice) / purchasePrice) * 100;
    return `${revenue.toFixed(1)}`;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error(t("admin.productAdd.validation.requiredFields"));
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmSave = () => {
    // Show success messages
    toast.success(t("admin.productAdd.success"));
    toast.info(t("admin.productAdd.confirmationMessage"));
    
    // Close dialog
    setShowConfirmDialog(false);
    
    // Navigate after a short delay to show the messages
    setTimeout(() => {
      navigate("/admin/products");
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("admin.productAdd.title")}</h1>
          <p className="text-muted-foreground">{t("admin.productAdd.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Product Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.productAdd.basicInfo")}</CardTitle>
              <CardDescription>{t("admin.productAdd.basicInfoDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">{t("admin.productAdd.barcode")} *</Label>
                  <div className="flex gap-2">
                  <Input
                    id="barcode"
                    value={formData.barcode || ""}
                    onChange={(e) => handleInputChange("barcode", e.target.value)}
                    placeholder={t("admin.productAdd.barcodePlaceholder")}
                      className={errors.barcode ? "border-red-500" : ""}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateBarcode}
                      className="px-3"
                      title={t("admin.productAdd.generateBarcode")}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.barcode && <p className="text-sm text-red-500">{errors.barcode}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productName">{t("admin.productAdd.productName")} *</Label>
                  <Input
                    id="productName"
                    value={formData.productName || ""}
                    onChange={(e) => handleInputChange("productName", e.target.value)}
                    placeholder={t("admin.productAdd.productNamePlaceholder")}
                    className={errors.productName ? "border-red-500" : ""}
                  />
                  {errors.productName && <p className="text-sm text-red-500">{errors.productName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="family">{t("admin.productAdd.family")} *</Label>
                  <Popover open={familyOpen} onOpenChange={setFamilyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={familyOpen}
                        className={cn(
                          "w-full justify-between",
                          errors.family && "border-red-500"
                        )}
                      >
                        {formData.family || t("admin.productAdd.selectFamily")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder={t("admin.productAdd.searchFamily")}
                          value={familySearch}
                          onValueChange={setFamilySearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center p-2">
                              <span className="text-sm text-muted-foreground">{t("admin.productAdd.noFamiliesFound")}</span>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Always show create new option */}
                            <CommandItem
                              onSelect={() => {
                                handleInputChange("family", familySearch);
                                setFamilyOpen(false);
                              }}
                              className="text-blue-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t("admin.productAdd.createNew")} "{familySearch}"
                            </CommandItem>
                            {mockFamilies
                              .filter(family => 
                                family.familyName.toLowerCase().includes(familySearch.toLowerCase())
                              )
                              .map((family) => (
                                <CommandItem
                                  key={family.idFamily}
                                  value={family.familyName}
                                  onSelect={() => {
                                    handleInputChange("family", family.familyName);
                                    setFamilyOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.family === family.familyName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {family.familyName}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.family && <p className="text-sm text-red-500">{errors.family}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">{t("admin.productAdd.brand")} *</Label>
                  <Popover open={brandOpen} onOpenChange={setBrandOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={brandOpen}
                        className={cn(
                          "w-full justify-between",
                          errors.brand && "border-red-500"
                        )}
                      >
                        {formData.brand || t("admin.productAdd.selectBrand")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder={t("admin.productAdd.searchBrand")}
                          value={brandSearch}
                          onValueChange={setBrandSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center p-2">
                              <span className="text-sm text-muted-foreground">{t("admin.productAdd.noBrandsFound")}</span>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Always show create new option */}
                            <CommandItem
                              onSelect={() => {
                                handleInputChange("brand", brandSearch);
                                setBrandOpen(false);
                              }}
                              className="text-blue-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t("admin.productAdd.createNew")} "{brandSearch}"
                            </CommandItem>
                            {mockBrands
                              .filter(brand => 
                                brand.brandName.toLowerCase().includes(brandSearch.toLowerCase())
                              )
                              .map((brand) => (
                                <CommandItem
                                  key={brand.idBrand}
                                  value={brand.brandName}
                                  onSelect={() => {
                                    handleInputChange("brand", brand.brandName);
                                    setBrandOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.brand === brand.brandName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {brand.brandName}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.brand && <p className="text-sm text-red-500">{errors.brand}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">{t("admin.productAdd.model")} *</Label>
                  <Popover open={modelOpen} onOpenChange={setModelOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={modelOpen}
                        disabled={!formData.family || !formData.brand}
                        className={cn(
                          "w-full justify-between",
                          errors.model && "border-red-500"
                        )}
                      >
                        {formData.model || t("admin.productAdd.selectModel")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder={t("admin.productAdd.searchModel")}
                          value={modelSearch}
                          onValueChange={setModelSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center p-2">
                              <span className="text-sm text-muted-foreground">{t("admin.productAdd.noModelsFound")}</span>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Always show create new option */}
                            <CommandItem
                              onSelect={() => {
                                handleInputChange("model", modelSearch);
                                setModelOpen(false);
                              }}
                              className="text-blue-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t("admin.productAdd.createNew")} "{modelSearch}"
                            </CommandItem>
                            {mockModels
                              .filter(model => 
                                model.modelName.toLowerCase().includes(modelSearch.toLowerCase())
                              )
                              .map((model) => (
                                <CommandItem
                                  key={model.idModel}
                                  value={model.modelName}
                                  onSelect={() => {
                                    handleInputChange("model", model.modelName);
                                    setModelOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.model === model.modelName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {model.modelName}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.model && <p className="text-sm text-red-500">{errors.model}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("admin.productAdd.description")}</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder={t("admin.productAdd.descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">{t("admin.productAdd.quantity")} *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity || ""}
                    onChange={(e) => handleInputChange("quantity", parseInt(e.target.value) || 0)}
                    placeholder={t("admin.productAdd.quantityPlaceholder")}
                    className={errors.quantity ? "border-red-500" : ""}
                  />
                  {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">{t("admin.productAdd.supplier")}</Label>
                  <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierOpen}
                        className="w-full justify-between"
                      >
                        {selectedSupplier || t("admin.productAdd.selectSupplier")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput
                          placeholder={t("admin.productAdd.searchSupplier")}
                          value={supplierSearch}
                          onValueChange={setSupplierSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center p-2">
                              <span className="text-sm text-muted-foreground">{t("admin.productAdd.noSuppliersFound")}</span>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {/* Always show create new option */}
                            <CommandItem
                              onSelect={() => {
                                setSelectedSupplier(supplierSearch);
                                setSupplierOpen(false);
                              }}
                              className="text-blue-600"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t("admin.productAdd.createNew")} "{supplierSearch}"
                            </CommandItem>
                            {mockSuppliers
                              .filter(supplier => 
                                supplier.supplierName.toLowerCase().includes(supplierSearch.toLowerCase())
                              )
                              .map((supplier) => (
                                <CommandItem
                                  key={supplier.idSupplier}
                                  value={supplier.supplierName}
                                  onSelect={() => {
                                    setSelectedSupplier(supplier.supplierName);
                                    setSupplierOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedSupplier === supplier.supplierName ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {supplier.supplierName}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {t("admin.productAdd.pricing")}
              </CardTitle>
              <CardDescription>{t("admin.productAdd.pricingDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">{t("admin.productAdd.unitPrice")} (DA) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  value={formData.unitPrice || ""}
                  onChange={(e) => handleInputChange("unitPrice", parseFloat(e.target.value) || 0)}
                  placeholder={t("admin.productAdd.unitPricePlaceholder")}
                  className={errors.unitPrice ? "border-red-500" : ""}
                />
                {errors.unitPrice && <p className="text-sm text-red-500">{errors.unitPrice}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicPrice">{t("product.publicPrice")} (DA)</Label>
                <Input
                  id="publicPrice"
                  type="number"
                  value={formData.noUserPrice || ""}
                  onChange={(e) => handleInputChange("noUserPrice", parseFloat(e.target.value) || 0)}
                  placeholder={t("admin.productAdd.publicPricePlaceholder")}
                />
                {formData.unitPrice && formData.noUserPrice ?  (
                  <p className="text-sm text-muted-foreground">
                    {t("admin.productAdd.revenueCalculation").replace("{percentage}", calculateRevenue(formData.unitPrice, formData.noUserPrice))}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t("admin.productAdd.categoryPrices")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="premiumPrice">{t("admin.productAdd.premiumPrice")} (DA)</Label>
                    <Input
                      id="premiumPrice"
                      type="number"
                      value={categoryPrices[1] || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setCategoryPrices(prev => ({ ...prev, 1: value }));
                      }}
                      placeholder={t("admin.productAdd.premiumPricePlaceholder")}
                    />
                    {formData.unitPrice && categoryPrices[1] && (
                      <p className="text-xs text-green-600">
                        +{calculateRevenue(formData.unitPrice, categoryPrices[1])}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="standardPrice">{t("admin.productAdd.standardPrice")} (DA)</Label>
                    <Input
                      id="standardPrice"
                      type="number"
                      value={categoryPrices[2] || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setCategoryPrices(prev => ({ ...prev, 2: value }));
                      }}
                      placeholder={t("admin.productAdd.standardPricePlaceholder")}
                    />
                    {formData.unitPrice && categoryPrices[2] && (
                      <p className="text-xs text-green-600">
                        +{calculateRevenue(formData.unitPrice, categoryPrices[2])}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="basicPrice">{t("admin.productAdd.basicPrice")} (DA)</Label>
                    <Input
                      id="basicPrice"
                      type="number"
                      value={categoryPrices[3] || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setCategoryPrices(prev => ({ ...prev, 3: value }));
                      }}
                      placeholder={t("admin.productAdd.basicPricePlaceholder")}
                    />
                    {formData.unitPrice && categoryPrices[3] && (
                      <p className="text-xs text-green-600">
                        +{calculateRevenue(formData.unitPrice, categoryPrices[3])}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Image Upload */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.productAdd.images")}</CardTitle>
              <CardDescription>{t("admin.productAdd.uploadImages")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {images.length < 3 && (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">{t("admin.productAdd.uploadImage")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  {t("admin.productAdd.save")}
                </Button>
                <Button variant="outline" onClick={() => navigate("/admin/products")}>
                  {t("admin.productAdd.cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.productAdd.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.productAdd.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              {t("admin.productAdd.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>
              {t("admin.productAdd.confirmSave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}