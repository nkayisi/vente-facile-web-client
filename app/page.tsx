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
  ChevronDown
} from "lucide-react";
import { useState } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.png" alt="Vente Facile" width={44} height={44} className="object-contain" />
            <span className="text-xl font-bold">
              Vente<span className="text-orange-500">Facile</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-slate-600 hover:text-orange-600 transition-colors">
              Fonctionnalités
            </Link>
            <Link href="#pricing" className="text-slate-600 hover:text-orange-600 transition-colors">
              Tarifs
            </Link>
            <Link href="#about" className="text-slate-600 hover:text-orange-600 transition-colors">
              À propos
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="font-medium">Connexion</Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25">
                Commencer gratuitement
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
            <Link href="#features" className="block text-slate-600 hover:text-orange-600">
              Fonctionnalités
            </Link>
            <Link href="#pricing" className="block text-slate-600 hover:text-orange-600">
              Tarifs
            </Link>
            <Link href="#about" className="block text-slate-600 hover:text-orange-600">
              À propos
            </Link>
            <div className="pt-4 space-y-2">
              <Link href="/auth/login" className="block">
                <Button variant="outline" className="w-full">Connexion</Button>
              </Link>
              <Link href="/auth/register" className="block">
                <Button className="w-full bg-orange-500 hover:bg-orange-600">
                  Commencer gratuitement
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 overflow-hidden">
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
              className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium"
            >
              <Star className="h-4 w-4 fill-orange-500 text-orange-500" />
              <span>Solution #1 de gestion commerciale en RDC</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight">
              Gérez votre commerce
              <br />
              <span className="text-orange-500">
                en toute simplicité
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              La plateforme tout-en-un pour les entrepreneurs congolais.
              Ventes, stocks, clients, factures — tout au même endroit.
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
              className="flex flex-wrap items-center justify-center gap-8 pt-8 text-slate-500"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Essai gratuit 14 jours</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Sans carte bancaire</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Support 24/7</span>
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
                      <p className="text-2xl font-bold text-slate-900">2.5M</p>
                      <p className="text-sm text-slate-500">Ventes CDF</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <Package className="h-8 w-8 text-blue-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">1,234</p>
                      <p className="text-sm text-slate-500">Produits</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <Users className="h-8 w-8 text-purple-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">856</p>
                      <p className="text-sm text-slate-500">Clients</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                      <ShoppingCart className="h-8 w-8 text-orange-500 mb-2" />
                      <p className="text-2xl font-bold text-slate-900">342</p>
                      <p className="text-sm text-slate-500">Commandes</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gradient-to-b from-white to-slate-50">
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
              Une plateforme complète pour gérer tous les aspects de votre commerce
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: ShoppingCart, title: "Point de Vente", desc: "Vente rapide et intuitive avec gestion des paiements multiples", features: ["Interface tactile optimisée", "Gestion des devis et retours", "Suivi des caisses"], color: "text-orange-600" },
              { icon: Package, title: "Gestion des Stocks", desc: "Contrôle total de votre inventaire en temps réel", features: ["Tracking par lots et séries", "Gestion multi-entrepôts", "Alertes de réapprovisionnement"], color: "text-orange-500" },
              { icon: Users, title: "Gestion Clients", desc: "Relations clients et historique d'achats", features: ["Fiches clients détaillées", "Gestion des crédits", "Programme de fidélité"], color: "text-orange-600" },
              { icon: BarChart3, title: "Rapports & Analytics", desc: "Décisions éclairées avec des données précises", features: ["Tableaux de bord en temps réel", "Rapports personnalisables", "Export en PDF/Excel"], color: "text-orange-500" },
              { icon: CreditCard, title: "Facturation", desc: "Factures professionnelles et suivi des paiements", features: ["Factures conformes RDC", "Multi-devises (CDF, USD, EUR)", "TVA et taxes automatiques"], color: "text-orange-600" },
              { icon: Shield, title: "Sécurité", desc: "Protection de vos données et accès contrôlés", features: ["Multi-tenant isolé", "Rôles et permissions", "Sauvegarde automatique"], color: "text-orange-500" },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white h-full">
                  <CardHeader>
                    <feature.icon className={`h-12 w-12 ${feature.color} mb-4`} />
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-slate-600">
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

      {/* Benefits Section */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-slate-900">
              Conçu pour le contexte africain
            </h2>
            <p className="text-lg text-slate-600">
              Vente Facile est spécialement adapté aux réalités économiques et techniques
              de la République Démocratique du Congo.
            </p>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Smartphone className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-slate-900">Optimisé Mobile</h3>
                  <p className="text-slate-600">Fonctionne parfaitement sur smartphones et tablettes</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <TrendingUp className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-slate-900">Multi-devises</h3>
                  <p className="text-slate-600">Support CDF, USD, EUR avec taux de change automatiques</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-slate-900">Performant</h3>
                  <p className="text-slate-600">Rapide même avec connexion internet limitée</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl p-8">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Prêt à démarrer ?</h3>
              <p className="text-slate-600 mb-6">
                Rejoignez des centaines d'entreprises qui font confiance à Vente Facile
                pour gérer leur commerce au quotidien.
              </p>
              <Link href="/auth/register">
                <Button className="w-full bg-orange-500 hover:bg-orange-600">
                  Créer mon compte gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
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
              Pas besoin d'être un expert. Notre plateforme est conçue pour être simple et intuitive.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Créez votre compte", desc: "Inscription gratuite en 2 minutes. Aucune carte bancaire requise.", icon: Users },
              { step: "02", title: "Configurez votre boutique", desc: "Ajoutez vos produits, définissez vos prix et personnalisez.", icon: Store },
              { step: "03", title: "Commencez à vendre", desc: "Utilisez le POS pour enregistrer vos ventes facilement.", icon: ShoppingCart },
              { step: "04", title: "Analysez et grandissez", desc: "Consultez vos rapports et développez votre business.", icon: TrendingUp },
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

      {/* App Preview Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-orange-600 font-semibold text-sm uppercase tracking-wider">Interface moderne</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-4 mb-6">
              Découvrez l'application
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Une interface intuitive, disponible sur tous vos appareils
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8 items-center">
            {/* Mobile Preview Left */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="hidden lg:flex justify-center"
            >
              <div className="bg-slate-900 rounded-[3rem] p-3 shadow-2xl w-56">
                <div className="bg-slate-800 rounded-t-[2.5rem] pt-6 pb-2 px-4">
                  <div className="w-20 h-1 bg-slate-600 rounded-full mx-auto" />
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white rounded-b-[2.5rem] aspect-[9/16] flex items-center justify-center">
                  <div className="text-center p-4">
                    <Smartphone className="h-12 w-12 text-orange-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">Version Mobile</p>
                    <p className="text-slate-400 text-xs mt-1">Capture à remplacer</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Desktop Preview Center */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-1"
            >
              <div className="bg-slate-200 rounded-2xl p-3 shadow-2xl">
                <div className="bg-slate-800 rounded-t-xl px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-slate-400 text-sm">app.ventefacile.com</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white rounded-b-xl aspect-video flex items-center justify-center">
                  <div className="text-center p-8">
                    <BarChart3 className="h-16 w-16 text-orange-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Tableau de bord</p>
                    <p className="text-slate-400 text-sm mt-1">Capture d'écran à remplacer</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Mobile Preview Right */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="hidden lg:flex justify-center"
            >
              <div className="bg-slate-900 rounded-[3rem] p-3 shadow-2xl w-56">
                <div className="bg-slate-800 rounded-t-[2.5rem] pt-6 pb-2 px-4">
                  <div className="w-20 h-1 bg-slate-600 rounded-full mx-auto" />
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-white rounded-b-[2.5rem] aspect-[9/16] flex items-center justify-center">
                  <div className="text-center p-4">
                    <ShoppingCart className="h-12 w-12 text-orange-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium">Point de Vente</p>
                    <p className="text-slate-400 text-xs mt-1">Capture à remplacer</p>
                  </div>
                </div>
              </div>
            </motion.div>
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
              Des prix adaptés à votre business
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Commencez gratuitement, évoluez selon vos besoins. Tous les plans incluent 14 jours d'essai.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Starter", price: "29", desc: "Idéal pour les petits commerces", features: ["1 point de vente", "500 produits", "1 utilisateur", "Rapports basiques", "Support email"], popular: false },
              { name: "Business", price: "79", desc: "Pour les commerces en croissance", features: ["3 points de vente", "Produits illimités", "5 utilisateurs", "Rapports avancés", "Multi-entrepôts", "Support prioritaire"], popular: true },
              { name: "Enterprise", price: "Sur mesure", desc: "Pour les grandes entreprises", features: ["Points de vente illimités", "Utilisateurs illimités", "Intégrations sur mesure", "Account manager dédié", "Formation sur site", "SLA garanti"], popular: false },
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
                          <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
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
                        {plan.price === "Sur mesure" ? "Contactez-nous" : "Commencer l'essai"}
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
              Ils nous font confiance
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Découvrez ce que nos clients disent de Vente Facile
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Jean-Pierre Mukendi", role: "Gérant, Supermarché Kin Express", location: "Kinshasa", content: "Vente Facile a transformé la gestion de mon supermarché. Avant, je perdais des heures à faire l'inventaire. Maintenant, tout est automatisé !" },
              { name: "Marie Kabongo", role: "Propriétaire, Boutique Mode Élégance", location: "Lubumbashi", content: "Le support client est exceptionnel ! L'application est simple et mes vendeuses l'ont adoptée en une journée." },
              { name: "Patrick Ilunga", role: "Directeur, Pharmacie Santé Plus", location: "Goma", content: "La gestion des dates d'expiration est cruciale pour une pharmacie. Vente Facile m'alerte automatiquement. Indispensable !" },
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
                        <p className="text-xs text-slate-400">{testimonial.location}</p>
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
              { q: "Vente Facile fonctionne-t-il sans connexion internet ?", a: "Oui ! Vente Facile dispose d'un mode hors-ligne qui vous permet de continuer à vendre même sans internet. Vos données se synchronisent automatiquement dès que la connexion est rétablie." },
              { q: "Puis-je utiliser Vente Facile sur mon téléphone ?", a: "Absolument ! Vente Facile est entièrement responsive et fonctionne parfaitement sur smartphones, tablettes et ordinateurs." },
              { q: "Comment fonctionne l'essai gratuit ?", a: "L'essai gratuit de 14 jours vous donne accès à toutes les fonctionnalités du plan Business. Aucune carte bancaire n'est requise." },
              { q: "Mes données sont-elles sécurisées ?", a: "Oui, la sécurité est notre priorité. Vos données sont chiffrées, sauvegardées quotidiennement et hébergées sur des serveurs sécurisés." },
              { q: "Quels modes de paiement acceptez-vous ?", a: "Nous acceptons Mobile Money (M-Pesa, Airtel Money, Orange Money), carte bancaire et virement. Paiement en CDF ou USD." },
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
            Rejoignez plus de 500 entreprises qui utilisent Vente Facile pour gérer leur activité au quotidien.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/auth/register">
              <Button size="lg" variant="secondary" className="text-lg px-8 h-14 shadow-xl">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-2 border-white text-white hover:bg-white hover:text-orange-600">
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
      <footer className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Image src="/logo.png" alt="Vente Facile" width={36} height={36} className="object-contain" />
              <span className="text-xl font-bold">Vente Facile</span>
            </div>
            <p className="text-slate-400">
              La solution de gestion commerciale adaptée à la RDC
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Produit</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link href="/features" className="hover:text-white">Fonctionnalités</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Tarifs</Link></li>
              <li><Link href="/demo" className="hover:text-white">Démo</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link href="/help" className="hover:text-white">Aide</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              <li><Link href="/api/docs" className="hover:text-white">API</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Légal</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link href="/privacy" className="hover:text-white">Confidentialité</Link></li>
              <li><Link href="/terms" className="hover:text-white">Conditions</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-slate-800 text-center text-slate-400">
          <p>&copy; 2024 Vente Facile. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
