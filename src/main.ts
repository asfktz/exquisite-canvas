import './app.css';
import { mount } from 'svelte';
import EdgeApp from './edge/EdgeApp.svelte';
mount(EdgeApp, { target: document.getElementById('app')! });
