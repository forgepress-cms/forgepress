import { loadHome } from './content'
import { HomePage } from './home'

export default async function Page() {
  return <HomePage home={await loadHome()} />
}
