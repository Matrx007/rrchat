import Login from "./Login.vue";

const router = new VueRouter({
    reoutes: [
        { path: "/login", component: Login }
    ]
})

const app = Vue.createApp({});
app.use(router);

app.mount('#app');