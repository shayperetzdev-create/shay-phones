import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Shield,
  Package,
  Wrench,
  RefreshCw,
  Users,
  FileText,
  CheckCircle,
  Clock,
  BarChart3,
  Lock
} from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: Shield,
      title: 'ניהול אחריות',
      description: 'מעקב מקיף אחר אחריות המכשירים והפעלתן בקלות',
    },
    {
      icon: Wrench,
      title: 'ניהול תיקונים',
      description: 'ניהול יעיל של תיקונים ומעקב אחר סטטוס בזמן אמת',
    },
    {
      icon: RefreshCw,
      title: 'החלפות מכשירים',
      description: 'תהליך מהיר ויעיל לאישור והחלפת מכשירים',
    },
    {
      icon: BarChart3,
      title: 'דוחות מפורטים',
      description: 'דוחות ואנליטיקס לקבלת החלטות מושכלות',
    },
    {
      icon: Users,
      title: 'ניהול משתמשים',
      description: 'הרשאות מדויקות לחנויות, מעבדות ומנהלים',
    },
    {
      icon: Lock,
      title: 'אבטחה מתקדמת',
      description: 'הגנה מלאה על המידע עם הצפנה ו-RLS',
    },
  ];

  const benefits = [
    {
      icon: CheckCircle,
      title: 'חיסכון בזמן',
      description: 'אוטומציה של תהליכים ידניים',
    },
    {
      icon: Clock,
      title: 'זמינות 24/7',
      description: 'גישה למערכת מכל מקום ובכל זמן',
    },
    {
      icon: FileText,
      title: 'דיווח מיידי',
      description: 'מידע עדכני בזמן אמת',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">מערכת ניהול אחריות</h1>
            </div>
            <div className="flex gap-4">
              <Link href="/login">
                <Button variant="outline">התחברות</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>



      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            מערכת ניהול אחריות מתקדמת ליבואנים
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            פתרון מקיף לניהול אחריות, תיקונים והחלפות מכשירים.
            חסכו זמן, שפרו את השירות ושמרו על שליטה מלאה.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="px-8">
                התחל עכשיו
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8">
              צפה בהדגמה
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">תכונות המערכת</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">יתרונות המערכת</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="text-center">
                  <div className="inline-flex p-4 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                    <Icon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-xl font-semibold mb-2">{benefit.title}</h4>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">מתאים לכולם</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>מנהלי מערכת</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>שליטה מלאה במערכת</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>דוחות מקיפים</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>ניהול כספי</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>חנויות</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>הפעלת אחריות מהירה</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>מעקב אחר מכשירים</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>בקשות החלפה</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>מעבדות תיקון</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>ניהול תיקונים</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>דיווח סטטוס</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>מעקב תשלומים</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="mb-2">© 2025 מערכת ניהול אחריות. כל הזכויות שמורות.</p>
          <p className="text-sm">
          </p>
        </div>
      </footer>
    </div>
  );
}