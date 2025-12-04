<?php
/**
 * Plugin Name: Bicicolombia Form
 * Description: Embeds the Bicicolombia React Form.
 * Version: 1.7
 * Author: Bicicolombia
 */

if ( ! defined( 'ABSPATH' ) ) exit;

function bicicolombia_form_enqueue() {
    $plugin_dir_path = plugin_dir_path( __FILE__ );
    $plugin_dir_url = plugin_dir_url( __FILE__ );
    $dist_dir = $plugin_dir_path . 'dist/assets/';

    // Silent fail if assets missing
    if ( ! is_dir( $dist_dir ) ) {
        return;
    }

    // Find JS file
    $js_files = glob( $dist_dir . '*.js' );
    if ( ! empty( $js_files ) ) {
        $js_file = basename( $js_files[0] );
        wp_enqueue_script( 
            'bicicolombia-form-js', 
            $plugin_dir_url . 'dist/assets/' . $js_file, 
            array(), 
            '1.7', 
            true 
        );
    }

    // Find CSS file
    $css_files = glob( $dist_dir . '*.css' );
    if ( ! empty( $css_files ) ) {
        $css_file = basename( $css_files[0] );
        wp_enqueue_style( 
            'bicicolombia-form-css', 
            $plugin_dir_url . 'dist/assets/' . $css_file, 
            array(), 
            '1.7' 
        );
    }
}
add_action( 'wp_enqueue_scripts', 'bicicolombia_form_enqueue' );

// Add type="module"
function bicicolombia_add_type_attr($tag, $handle, $src) {
    if ( 'bicicolombia-form-js' !== $handle ) {
        return $tag;
    }
    return '<script type="module" src="' . esc_url( $src ) . '"></script>';
}
add_filter('script_loader_tag', 'bicicolombia_add_type_attr', 10, 3);

// Shortcode
function bicicolombia_form_shortcode() {
    return '<div id="root"></div>';
}
add_shortcode( 'bicicolombia_form', 'bicicolombia_form_shortcode' );
