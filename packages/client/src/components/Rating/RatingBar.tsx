import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './ratingBar.scss';
import { Rating } from '../../redux/Destinations/types';

export type RatingBarProps = {
    rating: Rating;
};

export class RatingBar extends React.Component<RatingBarProps> {
    render() {
        return (
            <div>
                {/*render "rating" number of solid stars*/}
                {Array.from(Array(this.props.rating).keys()).map((index) => (
                    <FontAwesomeIcon key={index} className="star-filled" icon={['fas', 'star']} />
                ))}
                {/*the rest of the stars are rendered as empty stars*/}
                {Array.from(Array(5 - this.props.rating).keys()).map((index) => (
                    <FontAwesomeIcon key={index} className="star-open" icon={['far', 'star']} />
                ))}
            </div>
        );
    }
}
