import './app.css';
import { mount } from 'svelte';
import PullApp from './pull/PullApp.svelte';
mount(PullApp, { target: document.getElementById('app')! });
