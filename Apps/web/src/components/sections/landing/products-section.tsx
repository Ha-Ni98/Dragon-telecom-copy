import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Grid, List, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { useFeaturedProducts, useProducts } from "@/hooks/use-products";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductCard } from "@/components/shared/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductWithDetails } from "@/types/draft-types/main-page.types";

// Local fallback in case query is empty; primary data comes from useProducts
const localAllProducts = [
  {
    id: 1,
    name: "iPhone 15 Pro Max",
    brand: "Apple",
    category: "Smartphones",
    image: "/api/placeholder/300/300",
    rating: 4.9,
    reviews: 234,
    features: ["256GB", "Titanium", "48MP Camera"],
    isNew: true,
    inStock: true,
  },
  {
    id: 2,
    name: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    category: "Smartphones",
    image: "/api/placeholder/300/300",
    rating: 4.8,
    reviews: 187,
    features: ["512GB", "S Pen", "200MP Camera"],
    isNew: true,
    inStock: true,
  },
  {
    id: 3,
    name: "Google Pixel 8 Pro",
    brand: "Google",
    category: "Smartphones",
    image: "/api/placeholder/300/300",
    rating: 4.7,
    reviews: 156,
    features: ["128GB", "Magic Eraser", "50MP Camera"],
    isNew: false,
    inStock: true,
  },
  {
    id: 4,
    name: "OnePlus 12",
    brand: "OnePlus",
    category: "Smartphones",
    image: "/api/placeholder/300/300",
    rating: 4.6,
    reviews: 98,
    features: ["256GB", "Hasselblad", "Fast Charging"],
    isNew: true,
    inStock: false,
  },
  {
    id: 5,
    name: "iPad Air M2",
    brand: "Apple",
    category: "Tablets",
    image: "/api/placeholder/300/300",
    rating: 4.8,
    reviews: 145,
    features: ["128GB", "M2 Chip", "11-inch"],
    isNew: true,
    inStock: true,
  },
  {
    id: 6,
    name: "Samsung Galaxy Tab S9",
    brand: "Samsung",
    category: "Tablets",
    image: "/api/placeholder/300/300",
    rating: 4.6,
    reviews: 89,
    features: ["256GB", "S Pen", "12.4-inch"],
    isNew: false,
    inStock: true,
  },
  {
    id: 7,
    name: "MacBook Pro M3",
    brand: "Apple",
    category: "Laptops",
    image: "/api/placeholder/300/300",
    rating: 4.9,
    reviews: 312,
    features: ["512GB", "M3 Pro", "14-inch"],
    isNew: true,
    inStock: true,
  },
  {
    id: 8,
    name: "Dell XPS 13",
    brand: "Dell",
    category: "Laptops",
    image: "/api/placeholder/300/300",
    rating: 4.5,
    reviews: 178,
    features: ["512GB", "Intel i7", "13.4-inch"],
    isNew: false,
    inStock: true,
  },
  {
    id: 9,
    name: "AirPods Pro 2",
    brand: "Apple",
    category: "Accessories",
    image: "/api/placeholder/300/300",
    rating: 4.7,
    reviews: 267,
    features: ["USB-C", "ANC", "Spatial Audio"],
    isNew: false,
    inStock: true,
  },
  {
    id: 10,
    name: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Accessories",
    image: "/api/placeholder/300/300",
    rating: 4.8,
    reviews: 198,
    features: ["30hr Battery", "ANC", "Touch Control"],
    isNew: false,
    inStock: true,
  },
  {
    id: 11,
    name: "LG OLED C3",
    brand: "LG",
    category: "TVs",
    image: "/api/placeholder/300/300",
    rating: 4.9,
    reviews: 156,
    features: ["55-inch", "4K", "OLED"],
    isNew: true,
    inStock: false,
  },
  {
    id: 12,
    name: "Samsung QLED Q80D",
    brand: "Samsung",
    category: "TVs",
    image: "/api/placeholder/300/300",
    rating: 4.6,
    reviews: 134,
    features: ["65-inch", "QLED", "Gaming Mode"],
    isNew: false,
    inStock: true,
  },
  {
    id: 13,
    name: "Nintendo Switch OLED",
    brand: "Nintendo",
    category: "Gaming",
    image: "/api/placeholder/300/300",
    rating: 4.8,
    reviews: 445,
    features: ["OLED Screen", "64GB", "Portable"],
    isNew: false,
    inStock: true,
  },
  {
    id: 14,
    name: "PlayStation 5",
    brand: "Sony",
    category: "Gaming",
    image: "/api/placeholder/300/300",
    rating: 4.9,
    reviews: 678,
    features: ["825GB SSD", "Ray Tracing", "4K Gaming"],
    isNew: false,
    inStock: false,
  },
  {
    id: 15,
    name: "Xbox Series X",
    brand: "Microsoft",
    category: "Gaming",
    image: "/api/placeholder/300/300",
    rating: 4.8,
    reviews: 567,
    features: ["1TB SSD", "Quick Resume", "4K Gaming"],
    isNew: false,
    inStock: true,
  },
];

const brands = ["All", "Apple", "Samsung", "Google", "OnePlus", "Dell", "Sony", "LG", "Nintendo", "Microsoft"];
const categories = ["All", "Smartphones", "Tablets", "Laptops", "Accessories", "TVs", "Gaming"];

export function ProductsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const itemsPerPage = 8;
  const maxInitialProducts = 30;

  // Use real authentication state; cart isn't wired yet (deferred to Sub-02, decision #2).
  const { isAuthenticated } = useAuth();
  const addToCart = async (_product: ProductWithDetails) => {};

  const { data: productsData, isLoading: isLoadingAll } = useProducts();
  const { data: featuredData, isLoading: isLoadingFeatured } = useFeaturedProducts(10);
  
  const mockProductsWithDetails = [
    {
      idProduct: 1,
      productName: "Galaxy S21",
      productDescription: "Flagship smartphone with advanced features and premium design",
      productCodeBar: "S21-001",
      brand: { idBrand: 1, brandName: "Samsung" },
      model: { idModel: 1, idBrand: 1, idFamily: 1, modelName: "Galaxy S21" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJEsBsdCwQOWAnFeNxr6Tr0KE5AB4GDbtV5A&s",
      price: 699,
      inStock: true,
      isNew: true,
      rating: 4.5,
      reviews: 234,
      features: ["256GB", "5G", "Triple Camera", "Wireless Charging"]
    },
    {
      idProduct: 2,
      productName: "Galaxy S24 Ultra",
      productDescription: "Latest flagship with S Pen and advanced AI features",
      productCodeBar: "S24U-001",
      brand: { idBrand: 1, brandName: "Samsung" },
      model: { idModel: 2, idBrand: 1, idFamily: 1, modelName: "Galaxy S24 Ultra" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=Galaxy+S24+Ultra",
      price: 1199,
      inStock: true,
      isNew: true,
      rating: 4.8,
      reviews: 187,
      features: ["512GB", "S Pen", "200MP Camera", "AI Features"]
    },
    {
      idProduct: 3,
      productName: "Galaxy A54",
      productDescription: "Mid-range smartphone with excellent value",
      productCodeBar: "A54-001",
      brand: { idBrand: 1, brandName: "Samsung" },
      model: { idModel: 3, idBrand: 1, idFamily: 1, modelName: "Galaxy A54" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=Galaxy+A54",
      price: 399,
      inStock: true,
      isNew: false,
      rating: 4.3,
      reviews: 156,
      features: ["128GB", "5G", "Dual Camera", "Fast Charging"]
    },
    {
      idProduct: 4,
      productName: "iPhone 15 Pro Max",
      productDescription: "Premium iPhone with titanium design and advanced camera system",
      productCodeBar: "IP15PM-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 4, idBrand: 2, idFamily: 1, modelName: "iPhone 15 Pro Max" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=iPhone+15+Pro+Max",
      price: 1199,
      inStock: false,
      isNew: true,
      rating: 4.9,
      reviews: 312,
      features: ["256GB", "Titanium", "48MP Camera", "USB-C"]
    },
    {
      idProduct: 5,
      productName: "iPhone 15",
      productDescription: "Latest iPhone with USB-C and improved camera",
      productCodeBar: "IP15-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 5, idBrand: 2, idFamily: 1, modelName: "iPhone 15" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=iPhone+15",
      price: 799,
      inStock: true,
      isNew: true,
      rating: 4.7,
      reviews: 198,
      features: ["128GB", "USB-C", "48MP Camera", "A17 Pro"]
    },
    {
      idProduct: 6,
      productName: "iPhone 14",
      productDescription: "Reliable iPhone with proven performance",
      productCodeBar: "IP14-001",
      brand: { idBrand: 2, brandName: "Apple" },
      model: { idModel: 6, idBrand: 2, idFamily: 1, modelName: "iPhone 14" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=iPhone+14",
      price: 699,
      inStock: true,
      isNew: false,
      rating: 4.6,
      reviews: 267,
      features: ["128GB", "A15 Bionic", "Dual Camera", "Lightning"]
    },
    {
      idProduct: 7,
      productName: "Pixel 8 Pro",
      productDescription: "Google's flagship with AI-powered features",
      productCodeBar: "P8P-001",
      brand: { idBrand: 3, brandName: "Google" },
      model: { idModel: 7, idBrand: 3, idFamily: 1, modelName: "Pixel 8 Pro" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=Pixel+8+Pro",
      price: 999,
      inStock: true,
      isNew: true,
      rating: 4.7,
      reviews: 156,
      features: ["128GB", "Magic Eraser", "50MP Camera", "AI Features"]
    },
    {
      idProduct: 8,
      productName: "Pixel 8",
      productDescription: "Pure Android experience with Google AI",
      productCodeBar: "P8-001",
      brand: { idBrand: 3, brandName: "Google" },
      model: { idModel: 8, idBrand: 3, idFamily: 1, modelName: "Pixel 8" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=Pixel+8",
      price: 699,
      inStock: true,
      isNew: true,
      rating: 4.5,
      reviews: 134,
      features: ["128GB", "Pure Android", "50MP Camera", "AI Features"]
    },
    {
      idProduct: 9,
      productName: "OnePlus 12",
      productDescription: "Flagship killer with Hasselblad camera",
      productCodeBar: "OP12-001",
      brand: { idBrand: 4, brandName: "OnePlus" },
      model: { idModel: 9, idBrand: 4, idFamily: 1, modelName: "OnePlus 12" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=OnePlus+12",
      price: 799,
      inStock: true,
      isNew: true,
      rating: 4.6,
      reviews: 98,
      features: ["256GB", "Hasselblad", "Fast Charging", "120Hz Display"]
    },
    {
      idProduct: 10,
      productName: "OnePlus 11",
      productDescription: "High-performance smartphone with fast charging",
      productCodeBar: "OP11-001",
      brand: { idBrand: 4, brandName: "OnePlus" },
      model: { idModel: 10, idBrand: 4, idFamily: 1, modelName: "OnePlus 11" },
      family: { idFamily: 1, familyName: "Smartphones" },
      image: "/api/placeholder/300/300?text=OnePlus+11",
      price: 699,
      inStock: true,
      isNew: false,
      rating: 4.4,
      reviews: 89,
      features: ["128GB", "Snapdragon 8 Gen 2", "100W Charging", "120Hz Display"]
    }
  ];
  // Resolve data sources
  const allProducts = useMemo(() => productsData ?? localAllProducts, [productsData]);
  const featuredProducts = useMemo(() => {
    // Use first 10 products from mock data with proper details
    const mockProductsWithDetails: ProductWithDetails[] = [
      {
        idProduct: 1,
        productName: "Galaxy S21",
        productDescription: "Flagship smartphone with advanced features and premium design",
        productCodeBar: "S21-001",
        brand: { idBrand: 1, brandName: "Samsung" },
        model: { idModel: 1, idBrand: 1, idFamily: 1, modelName: "Galaxy S21" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=Galaxy+S21",
        price: 699,
        inStock: true,
        isNew: true,
        rating: 4.5,
        reviews: 234,
        features: ["256GB", "5G", "Triple Camera", "Wireless Charging"]
      },
      {
        idProduct: 2,
        productName: "Galaxy S24 Ultra",
        productDescription: "Latest flagship with S Pen and advanced AI features",
        productCodeBar: "S24U-001",
        brand: { idBrand: 1, brandName: "Samsung" },
        model: { idModel: 2, idBrand: 1, idFamily: 1, modelName: "Galaxy S24 Ultra" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=Galaxy+S24+Ultra",
        price: 1199,
        inStock: true,
        isNew: true,
        rating: 4.8,
        reviews: 187,
        features: ["512GB", "S Pen", "200MP Camera", "AI Features"]
      },
      {
        idProduct: 3,
        productName: "Galaxy A54",
        productDescription: "Mid-range smartphone with excellent value",
        productCodeBar: "A54-001",
        brand: { idBrand: 1, brandName: "Samsung" },
        model: { idModel: 3, idBrand: 1, idFamily: 1, modelName: "Galaxy A54" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=Galaxy+A54",
        price: 399,
        inStock: true,
        isNew: false,
        rating: 4.3,
        reviews: 156,
        features: ["128GB", "5G", "Dual Camera", "Fast Charging"]
      },
      {
        idProduct: 4,
        productName: "iPhone 15 Pro Max",
        productDescription: "Premium iPhone with titanium design and advanced camera system",
        productCodeBar: "IP15PM-001",
        brand: { idBrand: 2, brandName: "Apple" },
        model: { idModel: 4, idBrand: 2, idFamily: 1, modelName: "iPhone 15 Pro Max" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=iPhone+15+Pro+Max",
        price: 1199,
        inStock: true,
        isNew: true,
        rating: 4.9,
        reviews: 312,
        features: ["256GB", "Titanium", "48MP Camera", "USB-C"]
      },
      {
        idProduct: 5,
        productName: "iPhone 15",
        productDescription: "Latest iPhone with USB-C and improved camera",
        productCodeBar: "IP15-001",
        brand: { idBrand: 2, brandName: "Apple" },
        model: { idModel: 5, idBrand: 2, idFamily: 1, modelName: "iPhone 15" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=iPhone+15",
        price: 799,
        inStock: true,
        isNew: true,
        rating: 4.7,
        reviews: 198,
        features: ["128GB", "USB-C", "48MP Camera", "A17 Pro"]
      },
      {
        idProduct: 6,
        productName: "iPhone 14",
        productDescription: "Reliable iPhone with proven performance",
        productCodeBar: "IP14-001",
        brand: { idBrand: 2, brandName: "Apple" },
        model: { idModel: 6, idBrand: 2, idFamily: 1, modelName: "iPhone 14" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=iPhone+14",
        price: 699,
        inStock: true,
        isNew: false,
        rating: 4.6,
        reviews: 267,
        features: ["128GB", "A15 Bionic", "Dual Camera", "Lightning"]
      },
      {
        idProduct: 7,
        productName: "Pixel 8 Pro",
        productDescription: "Google's flagship with AI-powered features",
        productCodeBar: "P8P-001",
        brand: { idBrand: 3, brandName: "Google" },
        model: { idModel: 7, idBrand: 3, idFamily: 1, modelName: "Pixel 8 Pro" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=Pixel+8+Pro",
        price: 999,
        inStock: true,
        isNew: true,
        rating: 4.7,
        reviews: 156,
        features: ["128GB", "Magic Eraser", "50MP Camera", "AI Features"]
      },
      {
        idProduct: 8,
        productName: "Pixel 8",
        productDescription: "Pure Android experience with Google AI",
        productCodeBar: "P8-001",
        brand: { idBrand: 3, brandName: "Google" },
        model: { idModel: 8, idBrand: 3, idFamily: 1, modelName: "Pixel 8" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=Pixel+8",
        price: 699,
        inStock: true,
        isNew: true,
        rating: 4.5,
        reviews: 134,
        features: ["128GB", "Pure Android", "50MP Camera", "AI Features"]
      },
      {
        idProduct: 9,
        productName: "OnePlus 12",
        productDescription: "Flagship killer with Hasselblad camera",
        productCodeBar: "OP12-001",
        brand: { idBrand: 4, brandName: "OnePlus" },
        model: { idModel: 9, idBrand: 4, idFamily: 1, modelName: "OnePlus 12" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=OnePlus+12",
        price: 799,
        inStock: true,
        isNew: true,
        rating: 4.6,
        reviews: 98,
        features: ["256GB", "Hasselblad", "Fast Charging", "120Hz Display"]
      },
      {
        idProduct: 10,
        productName: "OnePlus 11",
        productDescription: "High-performance smartphone with fast charging",
        productCodeBar: "OP11-001",
        brand: { idBrand: 4, brandName: "OnePlus" },
        model: { idModel: 10, idBrand: 4, idFamily: 1, modelName: "OnePlus 11" },
        family: { idFamily: 1, familyName: "Smartphones" },
        image: "/api/placeholder/300/300?text=OnePlus+11",
        price: 699,
        inStock: true,
        isNew: false,
        rating: 4.4,
        reviews: 89,
        features: ["128GB", "Snapdragon 8 Gen 2", "100W Charging", "120Hz Display"]
      }
    ];
    return featuredData ?? mockProductsWithDetails;
  }, [featuredData]);

  // Cart integration functions
  const handleAddToCart = useCallback(async (product: any) => {
    try {
      // Convert product to ProductWithDetails format
      const productWithDetails: ProductWithDetails = {
        idProduct: product.id,
        productName: product.name,
        productDescription: product.description,
        productCodeBar: `PROD-${product.id}`,
        brand: { idBrand: 1, brandName: product.brand },
        model: { idModel: 1, idBrand: 1, idFamily: 1, modelName: product.name },
        family: { idFamily: 1, familyName: product.category },
        image: product.image,
        price: product.price,
        inStock: product.inStock,
        isNew: product.isNew,
        rating: product.rating,
        reviews: product.reviews,
        features: product.features
      };
      
      addToCart(productWithDetails);
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  }, [addToCart]);

  const handleViewProduct = useCallback((productId: number) => {
    navigate(`/product/${productId}`);
  }, [navigate]);

  // Infinite scroll functionality
  // const handleLoadMore = useCallback(async () => {
  //   setIsLoadingMore(true);
  //   // Simulate API delay
  //   await new Promise(resolve => setTimeout(resolve, 1000));
  //   setCurrentPage(prev => prev + 1);
  //   setIsLoadingMore(false);
  // }, []);

  // Show "See All Products" button after 30 products
  // const shouldShowSeeAllButton = allProducts.length > maxInitialProducts && !showAllProducts;

  // Filter all products
  const filteredProducts = allProducts.filter((product) => {
    const productName = 'name' in product ? product.name : product.productName;
    const productBrand = 'brand' in product ? product.brand : (product as any).brand?.brandName || '';
    const productCategory = 'category' in product ? product.category : (product as any).family?.familyName || '';
    
    const matchesSearch = productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         productBrand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === "All" || productBrand === selectedBrand;
    const matchesCategory = selectedCategory === "All" || productCategory === selectedCategory;
    
    return matchesSearch && matchesBrand && matchesCategory;
  });

  // Pagination for all products view
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  // Convert product to ProductWithDetails format for ProductCard
  const convertToProductWithDetails = (product: any): ProductWithDetails => ({
    idProduct: product.id,
    productName: product.name,
    productDescription: product.description,
    productCodeBar: `PROD-${product.id}`,
    brand: { idBrand: 1, brandName: product.brand },
    model: { idModel: 1, idBrand: 1, idFamily: 1, modelName: product.name },
    family: { idFamily: 1, familyName: product.category },
    image: product.image,
    price: product.price,
    inStock: product.inStock,
    isNew: product.isNew,
    rating: product.rating,
    reviews: product.reviews,
    features: product.features
  });

  if (showAllProducts) {
    return (
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          {/* Header with Back Button */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setShowAllProducts(false)}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Featured Products
            </Button>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">All Products</h2>
            <p className="text-lg text-muted-foreground">
              Discover our complete collection of premium electronics and accessories
            </p>
          </div>

          {/* Search and Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Brand Filter */}
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="px-3"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-muted-foreground">
              Showing {paginatedProducts.length} of {filteredProducts.length} products
            </p>
          </div>

          {/* Products Grid */}
          {isLoadingAll ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : paginatedProducts.length > 0 ? (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              : "space-y-4 mb-8"
            }>
              {paginatedProducts.map((product) => {
                const productId = 'id' in product ? product.id : product.idProduct;
                return (
                  <ProductCard 
                    key={productId} 
                    product={convertToProductWithDetails(product)}
                    showPrice={isAuthenticated}
                    onAddToCart={() => handleAddToCart(product)}
                    onViewDetails={() => handleViewProduct(productId)}
                    isAuthenticated={isAuthenticated}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No products found matching your criteria.</p>
            </div>
          )}

          {/* Simple Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Featured Products View (default)
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('products.featured')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('products.description')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {isLoadingFeatured
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
            : mockProductsWithDetails.slice(0,10).map((product) => {
                const productId = 'id' in product ? product.id : product.idProduct;
                return (
                  <ProductCard 
                    
                    //product={convertToProductWithDetails(product)}
                    product={product}
                    showPrice={isAuthenticated}
                    isAuthenticated={isAuthenticated}
                  />
                );
              })}
        </div>

        {/* View All Products Button */}
        <div className="text-center mt-12">
            <Button 
              variant="outline" 
              size="lg" 
            onClick={() => navigate('/products')}
            >
              {t('products.viewAll')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
        </div>
      </div>
    </section>
  );
}