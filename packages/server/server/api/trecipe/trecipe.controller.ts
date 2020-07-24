import Controller from '../../common/controller';
import { NextFunction, Request, Response, Router } from 'express';
import TrecipeService from './trecipe.service';
import Trecipe from '../../../../shared/models/trecipe';
import CreateNewTrecipeDTO from '../../../../shared/models/createNewTrecipeDTO';
import { uuid } from 'uuidv4';
import { passportAuth } from '../../common/passport/passportUtils';
import { User } from '../../../../shared/models/user';
import UserService from '../user/user.service';

class TrecipeController implements Controller {
    public readonly path = '/trecipes';
    public readonly router = Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get(this.path, passportAuth, this.getAllTrecipes.bind(this));
        this.router.post(this.path, passportAuth, this.createTrecipe.bind(this));
        this.router.get(`${this.path}/:id`, passportAuth, this.getTrecipeById.bind(this));
        this.router.delete(`${this.path}/:id`, passportAuth, this.deleteTrecipeById.bind(this));
        this.router.put(`${this.path}/:id`, passportAuth, this.updateTrecipeById.bind(this));
        this.router.post(`${this.path}/copy`, passportAuth, this.duplicateTrecipe.bind(this));
    }

    private getAllTrecipes(req: Request, res: Response, next: NextFunction) {
        const user = req.user as User;
        TrecipeService.getAll(user)
            .then((trecipes: Array<Trecipe>) => {
                res.status(200).json(trecipes);
            })
            .catch((err) => next(err));
    }

    private createTrecipe(req: Request, res: Response, next: NextFunction) {
        const createNewDTO: CreateNewTrecipeDTO = req.body;
        const user = req.user as User;
        const newTrecipe: Trecipe = {
            ...createNewDTO,
            uuid: uuid(),
            owner: `${user.username}`,
            collaborators: [],
            image: '',
            destinations: [],
            createdAt: '',
            updatedAt: '',
        };
        TrecipeService.createTrecipe(newTrecipe)
            .then((createdTrecipe: Trecipe) => {
                UserService.updateUserByUsername(user.username, {
                    trecipes: [...user.trecipes, newTrecipe.uuid],
                }).then(() => {
                    res.status(201).json(createdTrecipe);
                });
            })
            .catch((err) => next(err));
    }

    private getTrecipeById(req: Request, res: Response, next: NextFunction) {
        const uuid: string = req.params.id;
        const user = req.user as User;
        TrecipeService.getTrecipeById(uuid, user)
            .then((foundTrecipe: Trecipe) => {
                res.status(200).json(foundTrecipe);
            })
            .catch((err) => next(err));
    }

    private deleteTrecipeById(req: Request, res: Response, next: NextFunction) {
        const uuid: string = req.params.id;
        const user = req.user as User;
        TrecipeService.deleteTrecipeById(uuid, user)
            .then((deletedCount) => {
                UserService.updateUserByUsername(user.username, {
                    trecipes: user.trecipes.filter((trecipeId) => {
                        return trecipeId !== uuid;
                    }),
                }).then(() => {
                    res.status(200).json({ deletedCount: deletedCount });
                });
            })
            .catch((err) => next(err));
    }

    private updateTrecipeById(req: Request, res: Response, next: NextFunction) {
        const uuid: string = req.params.id;
        const updateData: Trecipe = req.body;
        const user = req.user as User;
        TrecipeService.updateTrecipeById(uuid, updateData, user)
            .then((updated: Trecipe) => {
                res.status(200).json(updated);
            })
            .catch((err) => next(err));
    }

    private duplicateTrecipe(req: Request, res: Response, next: NextFunction) {
        const uuid: string = req.query.id as string;
        const user = req.user as User;
        TrecipeService.duplicateTrecipe(uuid, user)
            .then((copied: Trecipe) => {
                UserService.updateUserByUsername(user.username, {
                    trecipes: [...user.trecipes, copied.uuid],
                }).then(() => {
                    res.status(201).json(copied);
                });
            })
            .catch((err) => next(err));
    }
}

export default TrecipeController;
