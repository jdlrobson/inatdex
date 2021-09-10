import Vue from 'vue';
import App from './App.vue';

new Vue( {
    el: document.getElementById( 'app' ),
    render( createElement ) {
        return createElement( App, {} )
    }
} );

