import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import EdgeApp from './edge/EdgeApp.svelte';
const legacy = new URLSearchParams(location.search).has('legacy');
mount(legacy ? App : EdgeApp, { target: document.getElementById('app')! });
