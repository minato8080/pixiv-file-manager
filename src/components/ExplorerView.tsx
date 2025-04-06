import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileImage } from "lucide-react"
import type { SearchResult } from "../App"

interface ExplorerViewProps {
  results: SearchResult[]
  isLoading: boolean
}

export function ExplorerView({ results, isLoading }: ExplorerViewProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-medium mb-4">Search Results</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  <Skeleton className="h-32 w-full" />
                  <div className="p-2">
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="border rounded-lg p-4 flex flex-col items-center justify-center h-[400px] text-center">
        <FileImage className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No results found</h3>
        <p className="text-sm text-muted-foreground">Try adjusting your search criteria or selecting different tags</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-medium mb-4">Search Results ({results.length})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {results.map((result) => (
          <Card
            key={result.id}
            className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          >
            <CardContent className="p-0">
              <div className="aspect-square relative">
                <img
                  src={`asset:///${result.thumbnailPath}`}
                  alt={result.title}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = "placeholder.svg?height=100&width=100"
                  }}
                />
              </div>
              <div className="p-2">
                <p className="text-sm font-medium truncate" title={result.title}>
                  {result.title}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

