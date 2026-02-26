import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, ArrowLeft, Search } from "lucide-react"
import Link from "next/link"

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center">
            <Search className="h-12 w-12 text-purple-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-gray-900">
            404 - Page Not Found
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Don't worry, it happens to the best of us. Let's get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              If you believe this is an error, please contact the administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 