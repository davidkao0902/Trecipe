import React from 'react';
import { CoverPhoto } from '../../components/CoverPhoto/CoverPhoto';
import './DestinationPage.scss';
import { Button } from '../../components/Button/Button';
import { RootState } from '../../redux';
import { RouteComponentProps } from 'react-router';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import { bindActionCreators, Dispatch } from 'redux';
import { Marker, MarkerColor, StaticMap } from '../../components/Map/StaticMap';
import Destination, { getIcon, Rating, UserRating } from '../../../../shared/models/destination';
import { getDestinationByPlaceId } from '../../redux/Destinations/action';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getDestModel } from '../../components/Map/mapHelper';
import Review from './Review/review';
import { isEmpty } from 'lodash';
import { fetchAssociatedTrecipesRequest } from '../../redux/TrecipeList/action';
import Trecipe from '../../../../shared/models/trecipe';
import TrecipeCard from '../../components/TrecipeCard/TrecipeCard';
import { showModal } from '../../redux/Modal/action';
import TrecipePicker from '../../components/TrecipePicker/TrecipePicker';
import { CreateNewDestinationDTO } from '../../../../shared/models/createNewDestinationDTO';
import { NearbyDestCard } from './NearbyDestCard/NearbyDestCard';
import { RatingBar } from '../../components/Rating/RatingBar';
import { createLoadingSelector } from '../../redux/Loading/selector';
import { TrecipeListActionCategory } from '../../redux/TrecipeList/types';
import { toast } from 'react-toastify';
import FullScreenLoader from '../../components/Loading/FullScreenLoader';

/**
 * Destination props
 * placeId: place id of destination to display
 *          Since we want to be able to display places from Google as well as places from our database, using place id instead of uuid
 * associatedTrecipes: from redux store, list of all public trecipes containing this destination
 */
export type DestinationProps = ReturnType<typeof mapStateToProps> &
    ReturnType<typeof mapDispatchToProps> &
    RouteComponentProps<{ placeId: string }>;

/**
 * Destination state
 * nearbyDestinations: destinations nearby from Google Place API
 * destination: destination model
 * photos: photos of this destination from Google Place API
 * review: reviews from Google Place API
 */
export interface DestinationState {
    nearbyDestinations: Array<Destination>;
    destination: Destination | undefined;
    photos: Array<google.maps.places.PlacePhoto>;
    reviews: Array<google.maps.places.PlaceReview>;
    isLoadingDestination: boolean;
    isLoadingNearbys: boolean;
}

class DestinationPage extends React.Component<DestinationProps, DestinationState> {
    private static SAVE_DESTINATION_BUTTON = 'Save';

    private map: google.maps.Map;
    private mapService: google.maps.places.PlacesService;

    constructor(props: DestinationProps) {
        super(props);
        this.map = new google.maps.Map(document.createElement('div'));
        // service used for calling Google Place API
        this.mapService = new google.maps.places.PlacesService(this.map);
        // until fetch from Google Place API completes, those field will be empty/undefined
        this.state = {
            nearbyDestinations: [],
            destination: undefined,
            photos: [],
            reviews: [],
            isLoadingDestination: true,
            isLoadingNearbys: true,
        };
    }

    componentDidMount(): void {
        const placeId = this.props.match.params.placeId;
        // retrieve public trecipes containing this destination
        this.props.fetchAssociatedTrecipesRequest(placeId, 10);
        // we try to retrieve this destination from backend for user ratings (if it does not exist in backend that's ok)
        this.props.getDestinationByPlaceId(placeId);
        // use place id to fetch place details from Google
        this.initializeDestDetail(placeId);
    }

    componentDidUpdate(
        prevProps: Readonly<DestinationProps>,
        prevState: Readonly<DestinationState>,
        snapshot?: any
    ): void {
        // when we're looking at new destination, refetch destination details and associated trecipes
        const placeId = this.props.match.params.placeId;
        if (prevProps.match.params.placeId !== placeId) {
            this.props.fetchAssociatedTrecipesRequest(placeId, 10);
            this.initializeDestDetail(placeId);
        }
        // if destination in state has been defined, or when destination place id changes, refetch nearby destinations
        if (
            (!prevState.destination && this.state.destination) ||
            (prevState.destination &&
                this.state.destination &&
                prevState.destination.placeId !== this.state.destination.placeId)
        ) {
            this.initializeNearbyDestinations(this.state.destination);
        }
    }

    private initializeNearbyDestinations(destination: CreateNewDestinationDTO) {
        const center = new google.maps.LatLng(destination.geometry);
        const request = {
            location: center,
            radius: 500,
        };

        this.setState({ isLoadingNearbys: true });
        this.mapService.nearbySearch(request, this.processNearbySearchResults.bind(this));
    }

    private processNearbySearchResults(
        results: Array<google.maps.places.PlaceResult>,
        status: google.maps.places.PlacesServiceStatus
    ) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            this.setState({
                nearbyDestinations: results.map((place: google.maps.places.PlaceResult) =>
                    this.getDestModel(place)
                ),
                isLoadingNearbys: false,
            });
        } else {
            this.setState({
                nearbyDestinations: [] as Destination[],
                isLoadingNearbys: false,
            });
            toast(`Failed to request Google Place Nearby Search`, { type: toast.TYPE.ERROR });
        }
    }

    private initializeDestDetail(placeId: string) {
        this.setState({
            isLoadingDestination: true,
        });
        let request: google.maps.places.PlaceDetailsRequest = {
            placeId: placeId,
            fields: ['ALL'],
        };
        this.mapService.getDetails(request, this.processPlaceDetailResult.bind(this));
    }

    private processPlaceDetailResult(
        result: google.maps.places.PlaceResult,
        status: google.maps.places.PlacesServiceStatus
    ) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            this.setState({
                destination: this.getDestModel(result),
                photos: result.photos ? result.photos : [],
                reviews: result.reviews ? result.reviews : [],
                isLoadingDestination: false,
            });
        } else {
            this.setState({
                destination: undefined,
                photos: [] as google.maps.places.PlacePhoto[],
                reviews: [] as google.maps.places.PlaceReview[],
                isLoadingDestination: false,
            });
            toast(`Failed to request Google Place Details`, { type: toast.TYPE.ERROR });
        }
    }

    private openTrecipePicker() {
        if (this.state.destination) {
            const dest = this.state.destination;
            this.props.showModal(<TrecipePicker destination={dest} />);
        }
    }

    private getDestModel(place: google.maps.places.PlaceResult) {
        let userRating: UserRating[] = [];
        let dests = this.props.destinations.dests.filter((dest) => dest.placeId === place.place_id);
        if (dests.length !== 0) {
            userRating = dests[0].userRatings;
        }
        return {
            ...getDestModel(place),
            uuid: '',
            userRatings: userRating,
            description: '',
            // since we have access to actual PlacePhoto objects to get photo URL from, we'll use that to fetch photo from
            // client bypassing the server.
            photoRefs: place.photos
                ? place.photos.map((photo) => photo.getUrl({ maxHeight: 100 }))
                : [],
        };
    }

    private getMarkers(dest: Destination, nearbys: Array<Destination>): Array<Marker> {
        const nearbyMarkers: Marker[] = nearbys.map((nearbyDest, index) => {
            return {
                lat: nearbyDest.geometry.lat,
                long: nearbyDest.geometry.lng,
                color: MarkerColor.Grey,
                label: `${index + 1}`,
            };
        });
        const destMarker: Marker = {
            lat: dest.geometry.lat,
            long: dest.geometry.lng,
            color: MarkerColor.Blue,
        };
        return [destMarker, ...nearbyMarkers];
    }

    private getUserRating() {
        if (this.state.destination && this.state.destination?.userRatings.length !== 0) {
            return Math.round(
                this.state.destination.userRatings.reduce((acc: number, rating) => {
                    return (acc + rating.rating) as number;
                }, 0) / this.state.destination.userRatings.length
            ) as Rating;
        }

        return 0 as Rating;
    }

    render() {
        const destination: Destination | undefined = this.state.destination;
        // When we're fetching destination, its nearby destinations, and associated trecipes,
        // show a full screen loader
        if (
            !destination ||
            this.state.isLoadingDestination ||
            this.state.isLoadingNearbys ||
            this.props.isLoading
        ) {
            return <FullScreenLoader />;
        } else {
            // display up to 5 nearby locations and reviews
            const nearbys = this.state.nearbyDestinations.slice(0, 5);
            const reviews = this.state.reviews.slice(0, 5);
            return (
                <div>
                    <div className="dest-page-header-container">
                        <CoverPhoto
                            imageSource={
                                isEmpty(this.state.photos)
                                    ? null
                                    : this.state.photos[0].getUrl({ maxHeight: 600 })
                            }
                            buttons={
                                // if not logged in, hide the "save to trecipes" functionality
                                this.props.isAuthenticated
                                    ? [
                                          <Button
                                              key={DestinationPage.SAVE_DESTINATION_BUTTON}
                                              text={DestinationPage.SAVE_DESTINATION_BUTTON}
                                              icon={['far', 'star']}
                                              onClick={this.openTrecipePicker.bind(this)}
                                          />,
                                      ]
                                    : []
                            }>
                            <div className="dest-page-header-text">
                                <h1 className="dest-name">{destination.name}</h1>
                            </div>
                        </CoverPhoto>
                        <svg
                            className="border"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none">
                            <path d="M 0 0 Q 50 50 100 0 V 100 H 0 Z" />
                        </svg>
                    </div>
                    <div className="dest-page-content-wrapper">
                        <div className="content">
                            <div className="dest-details">
                                <div className="dest-info">
                                    <h1 className="dest-page-title">Location and Contact</h1>
                                    <span className="dest-info-item">
                                        <FontAwesomeIcon
                                            icon={getIcon(destination.category[0])}
                                            fixedWidth
                                        />
                                        <p className="info-text">
                                            {destination.category.join(', ')}
                                        </p>
                                    </span>
                                    {destination.formattedAddress && (
                                        <span className="dest-info-item">
                                            <FontAwesomeIcon icon="map-marker-alt" fixedWidth />
                                            <p className="info-text">
                                                {destination.formattedAddress}
                                            </p>
                                        </span>
                                    )}
                                    {destination.formattedPhoneNumber && (
                                        <span className="dest-info-item">
                                            <FontAwesomeIcon icon="phone" fixedWidth />
                                            <p className="info-text">
                                                {destination.formattedPhoneNumber}
                                            </p>
                                        </span>
                                    )}
                                    {destination.website && (
                                        <span className="dest-info-item">
                                            <FontAwesomeIcon
                                                icon={['far', 'window-maximize']}
                                                fixedWidth
                                            />
                                            <a
                                                className="router-link info-text"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                href={destination.website}>
                                                Website
                                            </a>
                                        </span>
                                    )}
                                    <h1 className="dest-page-title">Ratings</h1>
                                    <span className="dest-info-item">
                                        <span className="rating-icon">Trecipe</span>
                                        <RatingBar rating={this.getUserRating()} />
                                    </span>
                                    <span className="dest-info-item">
                                        <span className="rating-icon">
                                            <FontAwesomeIcon icon={['fab', 'google']} fixedWidth />
                                        </span>
                                        <RatingBar
                                            rating={
                                                this.state.destination === undefined
                                                    ? (0 as Rating)
                                                    : (this.state.destination.rating as Rating)
                                            }
                                        />
                                    </span>
                                    <h1 className="dest-page-title">Explore Nearby</h1>
                                    {nearbys.map((dest, index) => (
                                        <div className="nearby-dest-item" key={dest.placeId}>
                                            <Link
                                                to={`/destinations/${dest.placeId}`}
                                                className="router-link">
                                                <NearbyDestCard
                                                    destination={dest}
                                                    index={index + 1}
                                                />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                                <div className="dest-map-wrapper">
                                    <StaticMap
                                        markers={this.getMarkers(destination, nearbys)}
                                        markerSize={'mid'}
                                        height={isEmpty(reviews) ? 50 : 20}
                                    />
                                    {!isEmpty(reviews) && (
                                        <h1 className="dest-page-title">Reviews</h1>
                                    )}
                                    <div className="dest-ratings">
                                        {reviews.map((review) => (
                                            <Review key={review.author_name} review={review} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {!isEmpty(this.props.associatedTrecipes) && (
                                <div className="associated-trecipes-wrapper">
                                    <h1 className="dest-page-title">Explore Trecipes</h1>

                                    <ul className="associated-trecipes-list">
                                        {this.props.associatedTrecipes.map((trecipe: Trecipe) => (
                                            <Link
                                                key={trecipe.uuid}
                                                className="router-link associated-trecipe-item"
                                                to={`/trecipes/${trecipe.uuid}`}
                                                target="_blank">
                                                <TrecipeCard
                                                    trecipe={{ ...trecipe }}
                                                    isReadOnly={true}
                                                />
                                            </Link>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    }
}

const loadingSelector = createLoadingSelector([
    TrecipeListActionCategory.FETCH_ASSOCIATED_TRECIPES,
]);

const mapStateToProps = (state: RootState, ownProps: RouteComponentProps<{ placeId: string }>) => {
    return {
        destinations: state.destinations,
        associatedTrecipes: state.trecipeList.associatedTrecipes,
        isAuthenticated: state.user.isAuthenticated,
        isLoading: loadingSelector(state),
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => {
    return bindActionCreators(
        {
            getDestinationByPlaceId,
            fetchAssociatedTrecipesRequest,
            showModal,
        },
        dispatch
    );
};

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(DestinationPage));
