<?php

declare(strict_types=1);

namespace Dotswan\MapPicker\Fields;

use Closure;
use Filament\Forms\Components\Field;
use Dotswan\MapPicker\Contracts\MapOptions;
use Filament\Forms\Concerns\HasStateBindingModifiers;

class Map extends Field implements MapOptions
{
    use HasStateBindingModifiers;
    /**
     * Field view
     * @var string
     */
    public string $view = 'map-picker::fields.osm-map-picker';

    /**
     * Main field config variables
     * @var array
     */
    private array $mapConfig = [
        'type'                 => 'field',
        'statePath'            => '',
        'draggable'            => true,
        'showMarker'           => true,
        'tilesUrl'             => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        'attribution'          => null,
        'zoomOffset'           => -1,
        'tileSize'             => 512,
        'detectRetina'         => true,
        'rangeSelectField'     => 'distance',
        'minZoom'              => 0,
        'maxZoom'              => 28,
        'zoom'                 => 15,
        'clickable'            => false,
        'markerColor'          => '#3b82f6',
        'liveLocation'         => false,
        'bounds'               => false,
        'showMyLocationButton' => [false, false, 5000],
        'default'              => ['lat' => 0, 'lng' => 0],
        'markerHtml' => '',
        'markerIconUrl' => null,
        'markerIconSize' => [36, 36],
        'markerIconClassName' => '',
        'markerIconAnchor' => [18, 36],
        'searchable'          => false,
        'searchPlaceholder'   => 'Search address...'
    ];

    /**
     * Leaflet controls variables
     * @var array
     */
    private array $controls = [
        'zoomControl'       => true,
        'scrollWheelZoom'   => 'center',
        'doubleClickZoom'   => 'center',
        'touchZoom'         => 'center',
        'minZoom'           => 1,
        'maxZoom'           => 28,
        'zoom'              => 15,
        'fullscreenControl' => true,
    ];

    private array $extraStyle = [];

    /**
     * Extra leaflet controls variables
     * @var array
     */
    private array $extraControls = [];

    /**
     * Create json configuration string
     * @return string
     */
    public function getMapConfig(): string
    {
        $statePath = $this->getStatePath();
        $lastDotPosition = mb_strrpos($statePath, '.');
        $rangeSelectField = mb_substr($statePath, 0, $lastDotPosition + 1).$this->mapConfig['rangeSelectField'];
        return json_encode(
            array_merge($this->mapConfig, [
                'statePath' => $statePath,
                'rangeSelectField' => $rangeSelectField,
                'controls' => array_merge($this->controls, $this->extraControls)
            ])
        );
    }


    /**
     * Create extra styles string
     * @return string
     */
    public function getExtraStyle(): string
    {
        return implode(';', $this->extraStyle);
    }

    /**
     * Determines if the user can click to place the marker on the map.
     * @param Closure|bool $clickable
     * @return $this
     */
    public function clickable(Closure|bool $clickable): self
    {
        $this->mapConfig['clickable'] = $this->evaluate($clickable);
        return $this;
    }

    /**
     * Determine if user can drag map around or not.
     * @param Closure|bool $draggable
     * @return MapOptions
     * @note Default value is false
     */
    public function draggable(Closure|bool $draggable = true): self
    {
        $this->mapConfig['draggable'] = $this->evaluate($draggable);

        return $this;
    }


    /**
     * Prevents the map from panning outside the defined box, and sets
     * a default location in the center of the box. It makes sense to
     * use this with a minimum zoom that suits the size of your map and
     * the size of the box or the way it pans back to the bounding box
     * looks strange. You can call with $on set to false to undo this.
     *
     * @param Closure|bool $on
     * @param int|float $southWestLat
     * @param int|float $southWestLng
     * @param int|float $northEastLat
     * @param int|float $northEastLng
     * @return self
     */
    public function boundaries(Closure|bool $on, int|float $southWestLat = 0, int|float $southWestLng = 0, int|float $northEastLat = 0, int|float $northEastLng = 0): self
    {
        if ( ! $this->evaluate($on)) {
            $this->mapConfig['bounds'] = false;

            return $this;
        }

        $this->mapConfig['bounds']['sw'] = ['lat' => $southWestLat, 'lng' => $southWestLng];
        $this->mapConfig['bounds']['ne'] = ['lat' => $northEastLat, 'lng' => $northEastLng];
        $this->defaultLocation(($southWestLat + $northEastLat) / 2.0, ($southWestLng + $northEastLng) / 2.0);

        return $this;
    }

    /**
     * Convenience function for appropriate values for boundaries() when
     * you want the British Isles
     * @return self
     **/
    public function setBoundsToBritishIsles(): self
    {
        $this->boundaries(true, 49.5, -11, 61, 2);
        return $this;
    }


    public function defaultLocation(int|float $latitude, float|int $longitude): self
    {
        $this->mapConfig['default']['lat'] = $latitude;
        $this->mapConfig['default']['lng'] = $longitude;

        return $this;
    }


    /**
     * Set extra style
     * @param array $styles
     * @return self
     */
    public function extraStyles(array $styles = []): self
    {
        $this->extraStyle = $styles;
        return $this;
    }


    /**
     * Set default zoom
     * @param int $zoom
     * @return MapOptions
     * @note Default value 19
     */
    public function zoom(int $zoom): self
    {
        $this->controls['zoom'] = $zoom;
        return $this;
    }

    /**
     * Set max zoom
     * @param int $maxZoom
     * @return $this
     * @note Default value 20
     */
    public function maxZoom(int $maxZoom): self
    {
        $this->controls['maxZoom'] = $maxZoom;
        return $this;
    }

    /**
     * Set min zoom
     * @param int $maxZoom
     * @return $this
     * @note Default value 1
     */
    public function minZoom(int $minZoom): self
    {
        $this->controls['minZoom'] = $minZoom;
        return $this;
    }

    /**
     * Determine if marker is visible or not.
     * @param Closure|bool $show
     * @return $this
     * @note Default value is false
     */
    public function showMarker(Closure|bool $show = true): self
    {
        $this->mapConfig['showMarker'] = $this->evaluate($show);
        return $this;
    }

    /**
     * Set tiles url
     * @param string $url
     * @return $this
     */
    public function tilesUrl(string $url): self
    {
        $this->mapConfig['tilesUrl'] = $url;
        return $this;
    }


    /**
     * Use the value of another field on the form for the range of the
     * circle surrounding the marker
     * @param string $rangeSelectField,
     * return $this
     **/
    public function rangeSelectField(string $rangeSelectField): self
    {
        $this->mapConfig['rangeSelectField'] = $rangeSelectField;
        return $this;
    }

    /**
     * Determine if it detects retina monitors or not.
     * @param Closure|bool $detectRetina
     * @return $this
     */
    public function detectRetina(Closure|bool $detectRetina = true): self
    {
        $this->mapConfig['detectRetina'] = $this->evaluate($detectRetina);
        return $this;
    }

    /**
     * Determine if zoom box is visible or not.
     * @param Closure|bool $show
     * @return $this
     */
    public function showZoomControl(Closure|bool $show = true): self
    {
        $this->controls['zoomControl'] = $this->evaluate($show);
        return $this;
    }


    /**
     * Determine if fullscreen box is visible or not.
     * @param Closure|bool $show
     * @return $this
     */
    public function showFullscreenControl(Closure|bool $show = true): self
    {
        $this->controls['fullscreenControl'] = $this->evaluate($show);
        return $this;
    }

    /**
     * Change the marker color.
     * @param string $color
     * @return $this
     */
    public function markerColor(string $color): self
    {
        $this->mapConfig['markerColor'] = $color;
        return $this;
    }

    /**
     * Enable or disable live location updates for the map.
     * @param Closure|bool $send
     * @return $this
     */
    public function liveLocation(Closure|bool $send = true, Closure|bool $realtime = false, int $miliseconds = 5000): self
    {
        $this->mapConfig['liveLocation'] = [
            'send' => $this->evaluate($send),
            'realtime' => $this->evaluate($realtime),
            'miliseconds' => $miliseconds
        ];
        return $this;
    }

    /**
     * Enable or disable show my location button on map.
     * @param Closure|bool $showMyLocationButton
     * @return $this
     */
    public function showMyLocationButton(Closure|bool $showMyLocationButton = true): self
    {
        $this->mapConfig['showMyLocationButton'] = $this->evaluate($showMyLocationButton);
        return $this;
    }

    /**
     * Enable address search on the map.
     *
     * @param Closure|bool   $searchable
     * @param Closure|string $placeholder
     */
    public function searchable(Closure|bool $searchable = true, Closure|string $placeholder = 'Search address...'): self
    {
        $this->mapConfig['searchable'] = $this->evaluate($searchable);
        $this->mapConfig['searchPlaceholder'] = $this->evaluate($placeholder);

        return $this;
    }

    /**
     * Append extra controls to be passed to leaflet map object
     * @param array $control
     * @return $this
     */
    public function extraControl(array $control): self
    {
        $this->extraControls = array_merge($this->extraControls, $control);
        return $this;
    }

    /**
     * Append extra controls to be passed to leaflet tileLayer object
     * @param array $control
     * @return $this
     */
    public function extraTileControl(array $control): self
    {
        $this->mapConfig = array_merge($this->mapConfig, $control);
        return $this;
    }



    /**
     * Set custom HTML for marker icon
     * @param string $html
     * @return $this
     */
    public function markerHtml(string $html): self
    {
        $this->mapConfig['markerHtml'] = $html;
        return $this;
    }

    /**
     * Set marker icon URL
     * @param string|null $url
     * @return $this
     */
    public function markerIconUrl(?string $url): self
    {
        $this->mapConfig['markerIconUrl'] = $url;
        return $this;
    }

    /**
     * Set marker icon size
     * @param array $size
     * @return $this
     */
    public function markerIconSize(array $size): self
    {
        $this->mapConfig['markerIconSize'] = $size;
        return $this;
    }

    /**
     * Set marker icon class name
     * @param string $className
     * @return $this
     */
    public function markerIconClassName(string $className): self
    {
        $this->mapConfig['markerIconClassName'] = $className;
        return $this;
    }

    /**
     * Set marker icon anchor point
     * @param array $anchor
     * @return $this
     */
    public function markerIconAnchor(array $anchor): self
    {
        $this->mapConfig['markerIconAnchor'] = $anchor;
        return $this;
    }

    /**
     * Setup function
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
    }
}
