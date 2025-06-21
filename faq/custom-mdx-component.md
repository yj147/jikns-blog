# How can I add a custom MDX component?

Here's an example on how to create a donut chart from Chart.js (assuming you already have the dependencies installed) and use it in MDX posts. First, create a new `DonutChart.tsx` component in `components`:

```tsx
'use client'

import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const DonutChart = ({ data }) => {
  return <Doughnut data={data} />
}

export default Doughnut
```

Since the underlying `Doughnut` component uses React hooks, we add the `'use client'` directive to specify that it is a client side component. Also, there is an existing issue which prevents named components from being used, so we need to export the component as the default export.

Next, add the component to `MDXComponents.tsx`:

```diff
...
+ import DonutChart from './DonutChart'

export const components: MDXComponents = {
  Image,
  TOCInline,
  a: CustomLink,
  pre: Pre,
+  DonutChart,
  BlogNewsletterForm,
}
```

Now you can use the component in your MDX files:

```mdx
<DonutChart
  data={{
    labels: ['Red', 'Blue', 'Yellow'],
    datasets: [
      {
        data: [300, 50, 100],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
        hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
      },
    ],
  }}
/>
```
