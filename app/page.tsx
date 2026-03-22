"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Store,
  ShoppingCart,
  Users,
  BarChart3,
  Package,
  CreditCard,
  TrendingUp,
  Shield,
  Smartphone,
  Zap,
  ArrowRight,
  CheckCircle,
  Play,
  Star,
  Globe,
  Clock,
  Menu,
  X,
  ChevronDown,
  Layers,
  LineChart,
  Building2,
  Sparkles,
  BadgeCheck,
  Headphones,
  Lock,
  RefreshCw,
  Wifi,
  Receipt
} from "lucide-react";
import { useState } from "react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="flex items-center justify-between px-6 py-2 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Vente Facile" width={48} height={48} className="object-contain" />
            <span className="text-xl font-bold">
              Vente<span className="text-orange-500">Facile</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-slate-600 hover:text-orange-600 transition-colors font-medium">
              Fonctionnalités
            </Link>
            <Link href="#how-it-works" className="text-slate-600 hover:text-orange-600 transition-colors font-medium">
              Comment ça marche
            </Link>
            <Link href="#pricing" className="text-slate-600 hover:text-orange-600 transition-colors font-medium">
              Tarifs
            </Link>
            <Link href="#testimonials" className="text-slate-600 hover:text-orange-600 transition-colors font-medium">
              Témoignages
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="font-medium">Connexion</Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25">
                Essai gratuit
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-4"
          >
            <Link href="#features" className="block text-slate-600 hover:text-orange-600 font-medium">
              Fonctionnalités
            </Link>
            <Link href="#how-it-works" className="block text-slate-600 hover:text-orange-600 font-medium">
              Comment ça marche
            </Link>
            <Link href="#pricing" className="block text-slate-600 hover:text-orange-600 font-medium">
              Tarifs
            </Link>
            <Link href="#testimonials" className="block text-slate-600 hover:text-orange-600 font-medium">
              Témoignages
            </Link>
            <div className="pt-4 space-y-2">
              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">Connexion</Button>
              </Link>
              <Link href="/auth/register" className="block">
                <Button className="w-full bg-orange-500 hover:bg-orange-600">
                  Essai gratuit
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-20 px-6 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium"
            >
              <span>Plus de 10 000 entreprises nous font confiance</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight">
              Le système de caisse moderne
              <br />
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                conçu pour votre croissance
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Simplifiez la gestion de votre commerce avec notre plateforme tout-en-un.
              Ventes, stocks, clients et analyses. Tout ce dont vous avez besoin pour développer votre activité.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
            >
              <Link href="/auth/register">
                <Button size="lg" className="text-lg px-8 h-14 bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/25 group">
                  Démarrer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button variant="outline" size="lg" className="text-lg px-8 h-14 border-2 group">
                  <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Voir la démo
                </Button>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 md:gap-10 pt-8 text-slate-500"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>14 jours d'essai gratuit</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Annulez à tout moment</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <span>Support multi-devises</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-4 shadow-2xl shadow-slate-300/50 border border-slate-200">
              <div className="bg-white rounded-xl overflow-hidden">
                <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-slate-400 text-sm">app.ventefacile.com</span>
                  </div>
                </div>
                <div className="p-8 bg-gradient-to-br from-slate-50 to-white min-h-[300px] flex items-center justify-center">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">$125K</p>
                      <p className="text-sm text-slate-500">Ventes totales</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <Package className="h-8 w-8 text-blue-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">2,847</p>
                      <p className="text-sm text-slate-500">Produits</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <Users className="h-8 w-8 text-purple-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">1,234</p>
                      <p className="text-sm text-slate-500">Clients</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <ShoppingCart className="h-8 w-8 text-orange-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">856</p>
                      <p className="text-sm text-slate-500">Commandes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Logos Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-center"
          >
            <p className="text-sm text-slate-500 mb-6 uppercase tracking-wider font-medium">Ils nous font confiance</p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60 grayscale">
              <div className="flex items-center gap-2 text-slate-400">
                <Building2 className="h-8 w-8" />
                <span className="font-semibold text-lg">RetailCo</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Store className="h-8 w-8" />
                <span className="font-semibold text-lg">ShopMax</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Layers className="h-8 w-8" />
                <span className="font-semibold text-lg">MegaMart</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <LineChart className="h-8 w-8" />
                <span className="font-semibold text-lg">GrowthHub</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">Fonctionnalités</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 mb-6">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Une plateforme complète conçue pour gérer tous les aspects de votre commerce
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: ShoppingCart, title: "Point de Vente", desc: "Encaissement rapide et intuitif avec plusieurs modes de paiement", features: ["Interface tactile optimisée", "Paiements fractionnés & remboursements", "Mode hors-ligne"], color: "bg-orange-100 text-orange-600" },
              { icon: Package, title: "Gestion des Stocks", desc: "Contrôle en temps réel de tout votre inventaire", features: ["Suivi par lots et numéros de série", "Multi-entrepôts", "Alertes de stock bas"], color: "bg-blue-100 text-blue-600" },
              { icon: Users, title: "Gestion Clients", desc: "Construisez des relations durables avec vos clients", features: ["Fiches clients détaillées", "Historique d'achats", "Programmes de fidélité"], color: "bg-purple-100 text-purple-600" },
              { icon: BarChart3, title: "Rapports & Analyses", desc: "Prenez des décisions éclairées grâce à des données précises", features: ["Tableaux de bord en temps réel", "Rapports personnalisés", "Export PDF/Excel"], color: "bg-green-100 text-green-600" },
              { icon: Receipt, title: "Facturation", desc: "Factures professionnelles et suivi des paiements", features: ["Modèles personnalisables", "Support multi-devises", "Calcul automatique des taxes"], color: "bg-amber-100 text-amber-600" },
              { icon: Shield, title: "Sécurité & Accès", desc: "Sécurité de niveau entreprise pour vos données", features: ["Permissions par rôle", "Journaux d'audit", "Sauvegardes automatiques"], color: "bg-red-100 text-red-600" },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white h-full">
                  <CardHeader>
                    <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base">{feature.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm text-slate-600">
                      {feature.features.map((item) => (
                        <li key={item} className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div>
                <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">Pourquoi nous choisir</span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4">
                  Conçu pour le commerce moderne
                </h2>
              </div>
              <p className="text-lg text-slate-600 leading-relaxed">
                Que vous gériez un seul magasin ou plusieurs points de vente,
                Vente Facile s'adapte à vos besoins avec des fonctionnalités puissantes conçues pour les défis du commerce d'aujourd'hui.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Multi-devises</h3>
                    <p className="text-slate-600 text-sm">Support de 50+ devises avec taux de change automatiques</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Compatible mobile</h3>
                    <p className="text-slate-600 text-sm">Fonctionne parfaitement sur tous les appareils</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wifi className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Mode hors-ligne</h3>
                    <p className="text-slate-600 text-sm">Continuez à vendre même sans connexion internet</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Sync. temps réel</h3>
                    <p className="text-slate-600 text-sm">Mises à jour instantanées sur tous vos points de vente</p>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-8 text-white">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Zap className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">99.9%</p>
                      <p className="text-white/80">Disponibilité garantie</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Headphones className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">24/7</p>
                      <p className="text-white/80">Support client</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Lock className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">256-bit</p>
                      <p className="text-white/80">Chiffrement SSL</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white rounded-xl p-4 shadow-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 bg-orange-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">JD</div>
                    <div className="w-8 h-8 bg-blue-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">MK</div>
                    <div className="w-8 h-8 bg-green-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">AS</div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">10 000+</p>
                    <p className="text-xs text-slate-500">Utilisateurs satisfaits</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-orange-400 font-semibold text-sm uppercase tracking-wider">Comment ça marche</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Démarrez en 4 étapes simples
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Aucune expertise technique requise. Notre plateforme est conçue pour être intuitive et facile à utiliser.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Créez votre compte", desc: "Inscription en moins de 2 minutes. Sans carte bancaire.", icon: Users },
              { step: "02", title: "Configurez votre boutique", desc: "Ajoutez vos produits, définissez vos prix et personnalisez.", icon: Store },
              { step: "03", title: "Commencez à vendre", desc: "Utilisez le POS intuitif pour traiter vos ventes instantanément.", icon: ShoppingCart },
              { step: "04", title: "Développez votre activité", desc: "Analysez vos rapports et grandissez grâce aux données.", icon: TrendingUp },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="text-center relative"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-6 shadow-lg shadow-orange-500/25">
                  <item.icon className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 md:right-auto md:left-1/2 md:ml-8 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border-2 border-orange-500 text-orange-500 font-bold text-sm">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">Tarifs</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 mb-6">
              Des tarifs simples et transparents
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Commencez gratuitement, évoluez selon vos besoins. Tous les plans incluent 14 jours d'essai gratuit.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Starter", price: "29", priceLabel: "Sur mesure", desc: "Idéal pour les petits commerces", features: ["1 point de vente", "Jusqu'à 500 produits", "1 utilisateur", "Rapports basiques", "Support par email"], popular: false },
              { name: "Business", price: "79", priceLabel: "Sur mesure", desc: "Pour les commerces en croissance", features: ["Jusqu'à 3 points de vente", "Produits illimités", "5 utilisateurs", "Analyses avancées", "Multi-entrepôts", "Support prioritaire"], popular: true },
              { name: "Enterprise", price: "Sur mesure", priceLabel: "Sur mesure", desc: "Pour les grandes organisations", features: ["Points de vente illimités", "Utilisateurs illimités", "Intégrations sur mesure", "Gestionnaire de compte dédié", "Formation sur site", "SLA 99.9% garanti"], popular: false },
            ].map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className={`h-full relative ${plan.popular ? 'border-2 border-orange-500 shadow-xl shadow-orange-500/10' : 'border shadow-lg'}`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Plus populaire
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.desc}</CardDescription>
                    <div className="pt-4">
                      {plan.price === "Sur mesure" ? (
                        <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-slate-900">{plan.price}$</span>
                          <span className="text-slate-500">/mois</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-slate-600">
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link href="/auth/register" className="block pt-4">
                      <Button className={`w-full ${plan.popular ? 'bg-orange-500 hover:bg-orange-600' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                        {plan.price === "Sur mesure" ? "Contactez-nous" : "Essai gratuit"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">Témoignages</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 mb-6">
              Ils nous font confiance dans le monde entier
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Découvrez ce que nos clients disent de Vente Facile
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Sophie Martin", role: "Gérante, Boutique Élégance", location: "Paris, France", content: "Vente Facile a transformé la gestion de notre boutique. Le suivi des stocks à lui seul nous fait gagner des heures chaque semaine !" },
              { name: "Ahmed Benali", role: "Directeur, Marché Frais", location: "Casablanca, Maroc", content: "Le support multi-devises est parfait pour nos clients internationaux. La mise en place a été très simple et l'équipe support est excellente." },
              { name: "Marie Dupont", role: "Pharmacienne, Pharmacie Centrale", location: "Bruxelles, Belgique", content: "Le suivi des dates d'expiration est crucial pour notre pharmacie. Vente Facile nous alerte automatiquement. C'est devenu indispensable !" },
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full border-0 shadow-lg bg-white">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-orange-400 text-orange-400" />
                      ))}
                    </div>
                    <p className="text-slate-600 mb-6 italic">"{testimonial.content}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center text-white font-bold">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{testimonial.name}</p>
                        <p className="text-sm text-slate-500">{testimonial.role}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {testimonial.location}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 mb-6">
              Questions fréquentes
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              { q: "Vente Facile fonctionne-t-il hors ligne ?", a: "Oui ! Vente Facile dispose d'un mode hors-ligne qui vous permet de continuer à vendre même sans internet. Vos données se synchronisent automatiquement dès que la connexion est rétablie." },
              { q: "Puis-je utiliser Vente Facile sur mon téléphone ?", a: "Absolument ! Vente Facile est entièrement responsive et fonctionne parfaitement sur smartphones, tablettes et ordinateurs." },
              { q: "Comment fonctionne l'essai gratuit ?", a: "L'essai gratuit de 14 jours vous donne accès à toutes les fonctionnalités du plan Business. Aucune carte bancaire n'est requise pour commencer." },
              { q: "Mes données sont-elles sécurisées ?", a: "La sécurité est notre priorité. Vos données sont chiffrées en SSL 256-bit, sauvegardées quotidiennement et hébergées sur des serveurs sécurisés de niveau entreprise." },
              { q: "Quels modes de paiement acceptez-vous ?", a: "Nous acceptons les principales cartes bancaires, PayPal, Mobile Money et les virements bancaires. Paiements possibles en USD, EUR et de nombreuses autres devises." },
              { q: "Puis-je migrer depuis un autre système de caisse ?", a: "Oui ! Nous offrons une assistance gratuite pour la migration de vos données. Notre équipe vous aidera à importer vos produits, clients et historique en toute simplicité." },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-semibold text-slate-900">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-slate-600">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Prêt à transformer votre commerce ?
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Rejoignez plus de 10 000 entreprises dans le monde qui utilisent Vente Facile pour optimiser leurs opérations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 h-14 shadow-xl">
                Démarrer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2 text-black border-white hover:bg-white hover:text-orange-600">
                Parler à un conseiller
              </Button>
            </Link>
          </div>
          <p className="text-sm opacity-75">
            14 jours d'essai gratuit • Sans carte bancaire • Annulez à tout moment
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/logo.png" alt="Vente Facile" width={40} height={40} className="object-contain" />
                <span className="text-xl font-bold">Vente Facile</span>
              </div>
              <p className="text-slate-400 mb-6 max-w-sm">
                Le système de caisse moderne conçu pour les entreprises de toutes tailles. Gérez vos ventes, stocks et clients depuis n'importe où.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <BadgeCheck className="h-5 w-5 text-green-500" />
                  <span>Conforme SOC 2</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span>Conforme RGPD</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Tarifs</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Intégrations</Link></li>
                <li><Link href="/changelog" className="hover:text-white transition-colors">Nouveautés</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/help" className="hover:text-white transition-colors">Centre d'aide</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">Référence API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-3 text-slate-400">
                <li><Link href="/about" className="hover:text-white transition-colors">À propos</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Confidentialité</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Conditions d'utilisation</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Vente Facile. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Disponible dans 50+ pays</span>
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                <span>Support 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
