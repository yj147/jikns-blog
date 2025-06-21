# How can I customize the Kbar search?

The Kbar search is configured in `data/siteMetadata.js`. You can customize the search provider and its settings:

```javascript
const siteMetadata = {
  // ... other settings
  search: {
    provider: 'kbar', // kbar or algolia
    kbarConfig: {
      searchDocumentsPath: 'search.json', // path to load documents to search
    },
  },
}
```

## Customizing search results

The search results are generated from your blog posts and pages. You can customize what content is included in the search by modifying the `createSearchIndex` function in `contentlayer.config.ts`:

```typescript
const createSearchIndex = (allBlogs) => {
  if (
    siteMetadata?.search?.provider === 'kbar' &&
    siteMetadata.search.kbarConfig.searchDocumentsPath
  ) {
    writeFileSync(
      `public/${siteMetadata.search.kbarConfig.searchDocumentsPath}`,
      JSON.stringify(allCoreContent(sortPosts(allBlogs).filter((post) => !post.draft)))
    )
    console.log('Local search index generated...')
  }
}
```

## Adding custom search actions

You can add custom search actions by creating a custom Kbar component. Create a new file `components/KbarSearch.tsx`:

```tsx
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  useMatches,
  KBarResults,
} from 'kbar'

const searchActions = [
  {
    id: 'homepage',
    name: 'Homepage',
    shortcut: ['h'],
    keywords: 'home',
    perform: () => (window.location.pathname = '/'),
  },
  {
    id: 'blog',
    name: 'Blog',
    shortcut: ['b'],
    keywords: 'blog posts articles',
    perform: () => (window.location.pathname = '/blog'),
  },
  // Add more custom actions here
]

export default function KbarSearch({ children }) {
  return (
    <KBarProvider actions={searchActions}>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <KBarSearch />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </KBarProvider>
  )
}

function RenderResults() {
  const { results } = useMatches()

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) => (
        <div
          style={{
            background: active ? '#eee' : 'transparent',
            padding: '12px 16px',
          }}
        >
          {item.name}
        </div>
      )}
    />
  )
}
```

Then wrap your app with the custom Kbar provider in your layout component.
