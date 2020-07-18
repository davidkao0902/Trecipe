import { DestinationCategory } from "client/src/redux/Destinations/types";
import { Rating } from "./destination";

export interface CreateNewDestinationDTO {
    name: string;
    category: Array<DestinationCategory>;
    geometry: {
        lat: number;
        lng: number;
    };
    formattedAddress: string;
    formattedPhoneNumber: string;
    website: string;
    rating: Rating;
    placeId: string;
}
