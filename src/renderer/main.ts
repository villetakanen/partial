import { mount } from 'svelte'
import './theme.css'
import App from './App.svelte'

const target = document.getElementById('app')

if (!target) {
  throw new Error('Missing #app mount point in index.html')
}

mount(App, { target })
